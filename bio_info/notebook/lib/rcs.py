"""
RCS（Restricted Cubic Splines, 限制性立方样条）非线性检验模块

用于检验 exposure（如蛋白质表达量）与二分类结局（如高血压）之间的线性关系假设是否成立。

原理：
    对每个 exposure 拟合两个 Logistic 回归模型：
    - Reduced model (线性): logit(Y) = β₀ + β₁·X + Σβᵢ·covᵢ
    - Full model (RCS):    logit(Y) = β₀ + RCS(X, k knots) + Σβᵢ·covᵢ

    通过似然比检验 (Likelihood Ratio Test) 比较两模型：
        LR = -2 × (llf_linear - llf_rcs) ~ χ²(df = n_knots - 2)

    若 p_nonlinearity > 0.05，则线性假设成立；否则 exposure 与结局之间存在非线性关系。

参考文献：
    - Plasma proteomic signatures of social isolation and loneliness associated with morbidity and mortality
    - Frank Harrell, Regression Modeling Strategies (RCS 基函数公式)
"""

import gc
from typing import List

import numpy as np
import pyarrow as pa
import polars as pl
import statsmodels.api as sm
from scipy.stats import chi2
from joblib import Parallel, delayed

from datalake import get_catalog, scan_table

# 协变量字段（与 logistics.py 保持一致）
COVARIANCE_FIELDS = [
    "sex",
    "age",
    "bmi",
    "smoking_current",
    "smoking_past",
    "smoking_pack_years",
    "education",
    "income",
]

# 结局变量
OUTCOME_FIELD = "hpt"
# 数据源表
OLINK_TABLE = "ukb.olink_instance_0"
COV_TABLE = "ukb.hpt_cov_clean"
# RCS 检验结果存储表
RESULT_TABLE = "ukb.pwas_rcs_nonlinearity"
# RCS 曲线结果存储表
RCS_CURVE_TABLE = "ukb.pwas_rcs_curve"

# 结果表 Schema
RESULT_SCHEMA = pa.schema(
    [
        # exposure 字段名（如蛋白质名称）
        pa.field("exposure", pa.string()),
        # 线性模型（Reduced model）的对数似然值
        pa.field("llf_linear", pa.float64()),
        # RCS 模型（Full model）的对数似然值
        pa.field("llf_rcs", pa.float64()),
        # 似然比检验统计量: LR = -2 × (llf_linear - llf_rcs)
        pa.field("lr_statistic", pa.float64()),
        # 似然比检验自由度: df = n_knots - 2
        pa.field("df", pa.int32()),
        # 非线性检验 p 值，基于 χ² 分布
        pa.field("p_nonlinearity", pa.float64()),
        # 线性假设是否成立: p_nonlinearity > 0.05 时为 True
        pa.field("is_linear", pa.bool_()),
        # RCS 节点数量
        pa.field("n_knots", pa.int32()),
        # 有效样本量（去除缺失值后）
        pa.field("n_valid", pa.int32()),
    ]
)


def rcs(x, knots=None, n_knots=4):
    """
    生成限制性立方样条 (RCS) 的设计矩阵。

    基于 Frank Harrell 的 RCS 公式，在边界节点处施加线性约束，
    使样条在两端自然退化为线性。

    Args:
        x: 一维数组，输入的连续变量（如蛋白质表达量）
        knots: 指定节点位置。若为 None，则根据 n_knots 基于分位数自动选取
        n_knots: 节点数量，默认 4。常用 3-5 个节点

    Returns:
        basis: shape=(n, k-1) 的设计矩阵
            - 第 0 列: 线性项 (即 x 本身)
            - 第 1~k-2 列: k-2 个非线性项

    Note:
        n_knots=4 时，输出 3 列 (1 线性 + 2 非线性)，非线性检验 df=2
    """
    x = np.asarray(x).flatten()
    # 根据节点数选择分位数策略
    if knots is None:
        if n_knots == 3:
            knots = np.percentile(x, [10, 50, 90])
        elif n_knots == 4:
            knots = np.percentile(x, [5, 35, 65, 95])
        elif n_knots == 5:
            knots = np.percentile(x, [5, 27.5, 50, 72.5, 95])
        else:
            knots = np.percentile(x, np.linspace(5, 95, n_knots))
    knots = np.sort(knots)
    k = len(knots)

    # 构建基向量: 线性项 + (k-2) 个非线性项
    basis = np.zeros((len(x), k - 1))
    basis[:, 0] = x  # 线性项

    # 计算非线性基函数（Harrell 公式）
    for j in range(k - 2):
        term_j = np.maximum(0, x - knots[j]) ** 3
        # 在倒数第二个节点处施加线性约束
        term_j -= (
            np.maximum(0, x - knots[k - 2]) ** 3
            * (knots[k - 1] - knots[j])
            / (knots[k - 1] - knots[k - 2])
        )
        # 在最后一个节点处施加线性约束
        term_j += (
            np.maximum(0, x - knots[k - 1]) ** 3
            * (knots[k - 2] - knots[j])
            / (knots[k - 1] - knots[k - 2])
        )
        # 归一化，消除量纲影响
        basis[:, j + 1] = term_j / (knots[k - 1] - knots[0]) ** 2
    return basis


def _rcs_test_single(
    exposure_name: str,
    exposure_col: np.ndarray,
    cov_matrix: np.ndarray,
    outcome: np.ndarray,
    n_knots: int = 4,
) -> dict | None:
    """
    对单个 exposure 执行 RCS 非线性检验。

    拟合线性模型与 RCS 模型，通过似然比检验判断非线性是否显著。

    Args:
        exposure_name: exposure 字段名
        exposure_col: exposure 列数据 (一维 numpy 数组)
        cov_matrix: 协变量矩阵 (n × p)
        outcome: 结局变量 (n × 1)
        n_knots: RCS 节点数量

    Returns:
        检验结果字典，包含似然比统计量、p 值等；若拟合失败则返回 None
    """
    # 过滤含缺失值的样本
    valid_mask = ~(
        np.isnan(exposure_col)
        | np.isnan(cov_matrix).any(axis=1)
        | np.isnan(outcome.ravel())
    )
    if valid_mask.sum() < 100:
        return None

    x = exposure_col[valid_mask]
    cov = cov_matrix[valid_mask]
    y = outcome[valid_mask].ravel()

    try:
        # Reduced model: 线性 exposure + 协变量
        X_linear = sm.add_constant(np.column_stack([x, cov]))
        model_linear = sm.Logit(y, X_linear)
        result_linear = model_linear.fit(disp=False, maxiter=100)

        # Full model: RCS(exposure) + 协变量
        rcs_basis = rcs(x, n_knots=n_knots)
        X_rcs = sm.add_constant(np.column_stack([rcs_basis, cov]))
        model_rcs = sm.Logit(y, X_rcs)
        result_rcs = model_rcs.fit(disp=False, maxiter=100)

        # 似然比检验: LR = -2 × (llf_reduced - llf_full) ~ χ²(df)
        # df = RCS 非线性项个数 = n_knots - 2
        n_nonlinear = rcs_basis.shape[1] - 1
        lr_stat = -2 * (result_linear.llf - result_rcs.llf)
        p_nonlinearity = chi2.sf(lr_stat, df=n_nonlinear)

        return {
            "exposure": exposure_name,
            "llf_linear": result_linear.llf,
            "llf_rcs": result_rcs.llf,
            "lr_statistic": lr_stat,
            "df": n_nonlinear,
            "p_nonlinearity": p_nonlinearity,
            "is_linear": p_nonlinearity > 0.05,  # p > 0.05 则线性假设成立
            "n_knots": n_knots,
            "n_valid": int(valid_mask.sum()),
        }
    except Exception as e:
        print(f"Failed for {exposure_name}: {e}")
        return None


def batch_rcs_test(
    df: pl.DataFrame,
    exposure_fields: List[str],
    outcome_field: str = OUTCOME_FIELD,
    covariance_fields: List[str] = COVARIANCE_FIELDS,
    n_knots: int = 4,
    n_jobs: int = -1,
    result_table_name: str = RESULT_TABLE,
) -> pl.DataFrame:
    """
    批量执行 RCS 非线性检验。

    对每个 exposure 字段分别拟合线性模型和 RCS 模型，通过似然比检验
    判断 exposure 与结局之间是否存在非线性关系。结果写入 Iceberg 表。

    Args:
        df: 包含 exposure、结局、协变量的完整数据
        exposure_fields: 需要检验的 exposure 字段列表
        outcome_field: 二分类结局字段名
        covariance_fields: 协变量字段列表
        n_knots: RCS 节点数量 (默认 4)
        n_jobs: 并行任务数，-1 表示使用所有 CPU 核心
        result_table_name: Iceberg 结果表名

    Returns:
        检验结果 DataFrame，每行对应一个 exposure
    """
    catalog = get_catalog()

    # 提取协变量和结局为 numpy 数组，统一处理缺失值
    cov_matrix = (
        df.select(pl.col(covariance_fields).cast(pl.Float64))
        .fill_nan(np.nan)
        .fill_null(np.nan)
        .to_numpy()
    )
    outcome = (
        df.select(pl.col(outcome_field).cast(pl.Float64))
        .fill_nan(np.nan)
        .fill_null(np.nan)
        .to_numpy()
    )

    # 一次性提取所有 exposure 数据为矩阵，避免反复 collect
    all_exposure_data = (
        df.select(pl.col(exposure_fields).cast(pl.Float64))
        .fill_nan(np.nan)
        .fill_null(np.nan)
        .to_numpy()
    )
    exposure_cols = [all_exposure_data[:, i] for i in range(all_exposure_data.shape[1])]

    # 并行执行 RCS 检验
    results = Parallel(n_jobs=n_jobs, verbose=10, max_nbytes=1e6)(
        delayed(_rcs_test_single)(name, col, cov_matrix, outcome, n_knots)
        for name, col in zip(exposure_fields, exposure_cols)
    )

    valid_results = [r for r in results if r is not None]
    if not valid_results:
        print("No valid results.")
        raise Exception("RCS test error: No valid results")

    result_df = pl.DataFrame(valid_results, schema=RESULT_SCHEMA)

    # 写入 Iceberg 结果表（若已存在则重建）
    if result_table_name in [f"{ns}.{name}" for ns, name in catalog.list_tables("ukb")]:
        catalog.drop_table(result_table_name)
    result_table = catalog.create_table(result_table_name, schema=RESULT_SCHEMA)
    result_df.write_iceberg(result_table, "append")

    n_linear = result_df.filter(pl.col("is_linear").eq(1)).height
    n_total = result_df.height
    print(
        f"Done. {n_linear}/{n_total} exposures satisfy linearity assumption (p > 0.05)"
    )

    del all_exposure_data
    gc.collect()
    return result_df


def load_data(
    exposure_table: str = OLINK_TABLE,
    cov_table: str = COV_TABLE,
) -> pl.DataFrame:
    """
    加载 exposure 数据和协变量数据，按 eid 内连接。

    Args:
        exposure_table: exposure 数据源表名（如 Olink 蛋白质组表）
        cov_table: 协变量数据源表名

    Returns:
        包含 eid、结局、协变量和所有 exposure 字段的 DataFrame
    """
    exposure_lf = scan_table(exposure_table).with_columns(pl.col("eid").cast(pl.String))
    cov_lf = scan_table(cov_table)
    exposure_fields = list(exposure_lf.collect_schema().keys())
    exposure_fields.remove("eid")

    df = exposure_lf.join(
        cov_lf, left_on="eid", right_on="participant.eid", how="inner"
    )
    return df.select(
        ["eid", OUTCOME_FIELD, *COVARIANCE_FIELDS, *exposure_fields]
    ).collect()


def get_exposure_fields(
    df: pl.DataFrame,
    outcome_field: str = OUTCOME_FIELD,
    covariance_fields: List[str] = COVARIANCE_FIELDS,
) -> List[str]:
    """
    从 DataFrame 中识别 exposure 字段（排除 eid、结局和协变量）。

    Args:
        df: 输入 DataFrame
        outcome_field: 结局字段名
        covariance_fields: 协变量字段列表

    Returns:
        exposure 字段名列表
    """
    reserved = {"eid", outcome_field, *covariance_fields}
    return [name for name in df.columns if name not in reserved]


def rcs_predict_single(
    exposure_col: np.ndarray,
    cov_matrix: np.ndarray,
    outcome: np.ndarray,
    n_knots: int = 4,
    n_grid: int = 100,
    quantiles: list | None = None,
) -> dict | None:
    """
    拟合单个 exposure 的 RCS Logistic 模型，生成预测曲线数据和分位数参考表。

    Args:
        exposure_col: exposure 列数据 (一维 numpy 数组)
        cov_matrix: 协变量矩阵 (n × p)
        outcome: 结局变量 (n × 1)
        n_knots: RCS 节点数量
        n_grid: 预测网格点数
        quantiles: 分位数参考点列表 (默认 [5, 35, 65, 95])

    Returns:
        dict 包含:
            - 'curve': 曲线预测数据 (list[dict]: x, log_or, or, ci_lower, ci_upper)
            - 'quantile_table': 分位数参考表 (list[dict]: quantile, x_val, or, ci_lower, ci_upper)
            - 'knots': 节点位置
            - 'p_overall': RCS 模型整体似然比检验 p 值 (vs 空模型)
            - 'p_nonlinear': 非线性似然比检验 p 值 (vs 线性模型)
        拟合失败返回 None
    """
    if quantiles is None:
        quantiles = [5, 35, 65, 95]

    valid_mask = ~(
        np.isnan(exposure_col)
        | np.isnan(cov_matrix).any(axis=1)
        | np.isnan(outcome.ravel())
    )
    if valid_mask.sum() < 100:
        return None

    x = exposure_col[valid_mask]
    cov = cov_matrix[valid_mask]
    y = outcome[valid_mask].ravel()

    cov_means = cov.mean(axis=0)

    try:
        rcs_basis = rcs(x, n_knots=n_knots)
        knots_used = _get_knots(x, n_knots)

        X_rcs = sm.add_constant(np.column_stack([rcs_basis, cov]))
        model_rcs = sm.Logit(y, X_rcs)
        result_rcs = model_rcs.fit(disp=False, maxiter=100)

        X_linear = sm.add_constant(np.column_stack([x, cov]))
        model_linear = sm.Logit(y, X_linear)
        result_linear = model_linear.fit(disp=False, maxiter=100)

        X_null = sm.add_constant(cov)
        model_null = sm.Logit(y, X_null)
        result_null = model_null.fit(disp=False, maxiter=100)

        n_nonlinear = rcs_basis.shape[1] - 1

        lr_nonlinear = -2 * (result_linear.llf - result_rcs.llf)
        p_nonlinear = float(chi2.sf(lr_nonlinear, df=n_nonlinear))

        lr_overall = -2 * (result_null.llf - result_rcs.llf)
        p_overall = float(chi2.sf(lr_overall, df=rcs_basis.shape[1]))

        x_grid = np.linspace(x.min(), x.max(), n_grid)
        rcs_grid = rcs(x_grid, knots=knots_used, n_knots=n_knots)
        X_pred = sm.add_constant(
            np.column_stack([rcs_grid, np.tile(cov_means, (n_grid, 1))])
        )

        pred_logit = result_rcs.predict(X_pred)
        pred_logit_centered = pred_logit - pred_logit[len(pred_logit) // 2]
        or_values = np.exp(pred_logit_centered)

        cov_pred = result_rcs.cov_params()
        se_logit = np.sqrt(np.sum((X_pred @ cov_pred) * X_pred, axis=1))
        logit_ci_lower = pred_logit_centered - 1.96 * se_logit
        logit_ci_upper = pred_logit_centered + 1.96 * se_logit

        curve_data = []
        for i in range(n_grid):
            curve_data.append(
                {
                    "x": float(x_grid[i]),
                    "log_or": float(pred_logit_centered[i]),
                    "or": float(or_values[i]),
                    "or_ci_lower": float(np.exp(logit_ci_lower[i])),
                    "or_ci_upper": float(np.exp(logit_ci_upper[i])),
                }
            )

        x_quantiles = np.percentile(x, quantiles)
        rcs_quant = rcs(x_quantiles, knots=knots_used, n_knots=n_knots)
        X_quant_pred = sm.add_constant(
            np.column_stack([rcs_quant, np.tile(cov_means, (len(quantiles), 1))])
        )

        pred_logit_q = result_rcs.predict(X_quant_pred)
        pred_logit_q_centered = pred_logit_q - pred_logit_q[0]
        se_q = np.sqrt(np.sum((X_quant_pred @ cov_pred) * X_quant_pred, axis=1))
        se_q_centered = np.sqrt(
            se_q**2
            + se_q[0] ** 2
            - 2 * np.sum((X_quant_pred @ cov_pred) * X_quant_pred[0:1], axis=1)
        )

        quantile_table = []
        for i, q in enumerate(quantiles):
            or_q = float(np.exp(pred_logit_q_centered[i]))
            ci_lo = float(np.exp(pred_logit_q_centered[i] - 1.96 * se_q_centered[i]))
            ci_hi = float(np.exp(pred_logit_q_centered[i] + 1.96 * se_q_centered[i]))
            quantile_table.append(
                {
                    "quantile": int(q),
                    "x_val": float(x_quantiles[i]),
                    "or": or_q,
                    "ci_lower": ci_lo,
                    "ci_upper": ci_hi,
                }
            )

        return {
            "curve": curve_data,
            "quantile_table": quantile_table,
            "knots": knots_used.tolist(),
            "p_overall": p_overall,
            "p_nonlinear": p_nonlinear,
            "n_valid": int(valid_mask.sum()),
        }
    except Exception as e:
        print(e)
        return None


def _get_knots(x: np.ndarray, n_knots: int = 4) -> np.ndarray:
    """获取 RCS 节点位置，与 rcs() 函数的默认策略一致。"""
    if n_knots == 3:
        return np.percentile(x, [10, 50, 90])
    elif n_knots == 4:
        return np.percentile(x, [5, 35, 65, 95])
    elif n_knots == 5:
        return np.percentile(x, [5, 27.5, 50, 72.5, 95])
    else:
        return np.percentile(x, np.linspace(5, 95, n_knots))


def batch_rcs_curve_predict(
    df: pl.DataFrame,
    exposure_fields: List[str],
    outcome_field: str = OUTCOME_FIELD,
    covariance_fields: List[str] = COVARIANCE_FIELDS,
    n_knots: int = 4,
    n_grid: int = 100,
    n_jobs: int = -1,
    curve_table_name: str = RCS_CURVE_TABLE,
    quantile_table_name: str = "ukb.pwas_rcs_quantile_table",
) -> tuple[pl.DataFrame, pl.DataFrame]:
    """
    批量拟合 RCS 模型并生成预测曲线数据和分位数参考表，写入 Iceberg。

    Args:
        df: 包含 exposure、结局、协变量的完整数据
        exposure_fields: 需要处理的 exposure 字段列表
        outcome_field: 二分类结局字段名
        covariance_fields: 协变量字段列表
        n_knots: RCS 节点数量 (默认 4)
        n_grid: 预测网格点数 (默认 100)
        n_jobs: 并行任务数
        curve_table_name: 曲线数据 Iceberg 表名
        quantile_table_name: 分位数参考表 Iceberg 表名

    Returns:
        (curve_df, quantile_df) 元组
    """
    catalog = get_catalog()

    cov_matrix = (
        df.select(pl.col(covariance_fields).cast(pl.Float64))
        .fill_nan(np.nan)
        .fill_null(np.nan)
        .to_numpy()
    )
    outcome = (
        df.select(pl.col(outcome_field).cast(pl.Float64))
        .fill_nan(np.nan)
        .fill_null(np.nan)
        .to_numpy()
    )

    all_exposure_data = (
        df.select(pl.col(exposure_fields).cast(pl.Float64))
        .fill_nan(np.nan)
        .fill_null(np.nan)
        .to_numpy()
    )
    exposure_cols = [all_exposure_data[:, i] for i in range(all_exposure_data.shape[1])]

    results = Parallel(n_jobs=n_jobs, verbose=10, max_nbytes=1e6)(
        delayed(rcs_predict_single)(col, cov_matrix, outcome, n_knots, n_grid)
        for col in exposure_cols
    )

    curve_rows = []
    quantile_rows = []
    failed = 0
    for name, res in zip(exposure_fields, results):
        if res is None:
            failed += 1
            continue
        for pt in res["curve"]:
            curve_rows.append({"exposure": name, **pt})
        for qt in res["quantile_table"]:
            quantile_rows.append(
                {
                    "exposure": name,
                    "p_overall": res["p_overall"],
                    "p_nonlinear": res["p_nonlinear"],
                    "n_valid": res["n_valid"],
                    **qt,
                }
            )

    if not curve_rows:
        raise RuntimeError("RCS curve prediction: no valid results")

    curve_df = pl.DataFrame(curve_rows)
    quantile_df = pl.DataFrame(quantile_rows)

    for tbl_name, tbl_df in [
        (curve_table_name, curve_df),
        (quantile_table_name, quantile_df),
    ]:
        existing = [f"{ns}.{name}" for ns, name in catalog.list_tables("ukb")]
        if tbl_name in existing:
            catalog.drop_table(tbl_name)
        catalog.create_table(tbl_name, schema=tbl_df.schema.to_arrow())
        tbl_df.write_iceberg(catalog.load_table(tbl_name), "append")

    print(
        f"Done. {len(exposure_fields) - failed}/{len(exposure_fields)} proteins predicted. Failed: {failed}"
    )

    del all_exposure_data
    gc.collect()
    return curve_df, quantile_df


if __name__ == "__main__":
    df = load_data()
    exposure_fields = get_exposure_fields(df)
    print(f"Total exposures: {len(exposure_fields)}")

    batch_rcs_test(
        df=df,
        exposure_fields=exposure_fields,
        outcome_field=OUTCOME_FIELD,
        covariance_fields=COVARIANCE_FIELDS,
        n_knots=4,
    )
