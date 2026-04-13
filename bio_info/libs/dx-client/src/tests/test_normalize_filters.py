"""normalize_cohort_filters 单元测试 + 端到端测试。

测试重点：filter key 必须包含 entity 前缀（entity.field 或 entity$field），
裸字段名应抛出 DXCohortError。
"""

from __future__ import annotations

import sys
import time
import traceback
from pathlib import Path

from dotenv import load_dotenv

for _env_path in [
    Path(__file__).resolve().parents[2] / ".env",
    Path(__file__).resolve().parents[4] / ".env",
    Path(__file__).resolve().parents[5] / "bio_info" / ".env",
    Path(__file__).resolve().parents[6] / "bio_info" / ".env",
    Path(__file__).resolve().parents[7] / "bio_info" / ".env",
]:
    if _env_path.exists():
        load_dotenv(_env_path)
        break

from dx_client import DXClient, DXClientConfig, VizPhenoFilters
from dx_client.cohort import normalize_cohort_filters
from dx_client.dx_exceptions import DXCohortError

PASS = "\033[92mPASS\033[0m"
FAIL = "\033[91mFAIL\033[0m"
SKIP = "\033[93mSKIP\033[0m"

results: list[tuple[str, str, str]] = []


def report(method: str, status: str, detail: str = "") -> None:
    tag = {"pass": PASS, "fail": FAIL, "skip": SKIP}[status]
    print(f"  {tag}  {method}" + (f"  — {detail}" if detail else ""))
    results.append((method, status, detail))


# ── 单元测试 ────────────────────────────────────────────────────────────


def test_raw_field_name_raises():
    """纯字段名 ``p131286`` 应抛出 DXCohortError。"""
    filters = {
        "logic": "and",
        "pheno_filters": {
            "logic": "and",
            "compound": [
                {
                    "name": "phenotype",
                    "logic": "and",
                    "filters": {
                        "p131286": [{"condition": "exists", "values": []}],
                    },
                }
            ],
        },
    }
    try:
        normalize_cohort_filters(filters)
        report("test_raw_field_name_raises", "fail", "expected DXCohortError")
    except DXCohortError as e:
        if "p131286" in str(e) and "entity" in str(e):
            report("test_raw_field_name_raises", "pass", str(e))
        else:
            report("test_raw_field_name_raises", "fail", f"wrong message: {e}")


def test_normalize_dot_notation():
    """entity.field 格式 ``participant.p131286`` → ``participant$p131286``"""
    filters = {
        "logic": "and",
        "pheno_filters": {
            "logic": "and",
            "compound": [
                {
                    "name": "phenotype",
                    "logic": "and",
                    "filters": {
                        "participant.p131286": [{"condition": "exists", "values": []}],
                    },
                }
            ],
        },
    }
    result = normalize_cohort_filters(filters)
    key = list(result.pheno_filters.compound[0].filters.keys())[0]
    if key == "participant$p131286":
        report("test_normalize_dot_notation", "pass", f"{key}")
    else:
        report(
            "test_normalize_dot_notation",
            "fail",
            f"expected participant$p131286, got {key}",
        )


def test_normalize_already_dollar():
    """已经是 ``entity$field`` 格式的不应改变。"""
    filters = {
        "logic": "and",
        "pheno_filters": {
            "logic": "and",
            "compound": [
                {
                    "name": "phenotype",
                    "logic": "and",
                    "filters": {
                        "participant$p131286": [{"condition": "exists", "values": []}],
                    },
                }
            ],
        },
    }
    result = normalize_cohort_filters(filters)
    key = list(result.pheno_filters.compound[0].filters.keys())[0]
    if key == "participant$p131286":
        report("test_normalize_already_dollar", "pass", f"{key}")
    else:
        report(
            "test_normalize_already_dollar",
            "fail",
            f"expected participant$p131286, got {key}",
        )


def test_normalize_multiple_keys():
    """多个不同格式的 key 同时规范化。"""
    filters = {
        "logic": "and",
        "pheno_filters": {
            "logic": "and",
            "compound": [
                {
                    "name": "phenotype",
                    "logic": "and",
                    "filters": {
                        "participant.p131286": [{"condition": "exists", "values": []}],
                        "participant$p31": [{"condition": "is", "values": "Female"}],
                        "participant.p21003_i0": [
                            {"condition": "greater-than", "values": [50]}
                        ],
                    },
                }
            ],
        },
    }
    result = normalize_cohort_filters(filters)
    keys = sorted(result.pheno_filters.compound[0].filters.keys())
    expected = sorted(
        [
            "participant$p131286",
            "participant$p31",
            "participant$p21003_i0",
        ]
    )
    if keys == expected:
        report("test_normalize_multiple_keys", "pass", f"{keys}")
    else:
        report(
            "test_normalize_multiple_keys", "fail", f"expected {expected}, got {keys}"
        )


def test_normalize_typed_vizphnofilters():
    """直接传入 VizPhenoFilters typed model 也应规范化 key。"""
    from dx_client.dx_models import VizPhenoFiltersInner

    viz = VizPhenoFilters(
        logic="and",
        pheno_filters=VizPhenoFiltersInner(
            logic="and",
            compound=[
                {
                    "name": "phenotype",
                    "logic": "and",
                    "filters": {
                        "participant.p131286": [{"condition": "exists", "values": []}],
                    },
                }
            ],
        ),
    )
    result = normalize_cohort_filters(viz)
    key = list(result.pheno_filters.compound[0].filters.keys())[0]
    if key == "participant$p131286":
        report("test_normalize_typed_vizphnofilters", "pass", f"{key}")
    else:
        report(
            "test_normalize_typed_vizphnofilters",
            "fail",
            f"expected participant$p131286, got {key}",
        )


def test_rules_filter_dot_notation():
    """RulesFilter 的 field 使用 entity.field 格式。"""
    filters = {
        "logic": "and",
        "rules": [
            {"field": "participant.p131286", "operator": "is_not_null"},
            {"field": "participant.p31", "operator": "eq", "value": "Female"},
        ],
    }
    result = normalize_cohort_filters(filters)
    keys = sorted(result.pheno_filters.compound[0].filters.keys())
    expected = sorted(["participant$p131286", "participant$p31"])
    if keys == expected:
        report("test_rules_filter_dot_notation", "pass", f"{keys}")
    else:
        report(
            "test_rules_filter_dot_notation", "fail", f"expected {expected}, got {keys}"
        )


def test_rules_filter_raw_field_raises():
    """RulesFilter 中裸字段名应抛出 DXCohortError。"""
    filters = {
        "logic": "and",
        "rules": [
            {"field": "p131286", "operator": "is_not_null"},
        ],
    }
    try:
        normalize_cohort_filters(filters)
        report("test_rules_filter_raw_field_raises", "fail", "expected DXCohortError")
    except DXCohortError as e:
        if "p131286" in str(e):
            report("test_rules_filter_raw_field_raises", "pass", str(e))
        else:
            report("test_rules_filter_raw_field_raises", "fail", f"wrong message: {e}")


def test_filter_rule_dot_notation():
    """单条 FilterRule 的 field 使用 entity.field 格式。"""
    filters = {"field": "participant.p131286", "operator": "is_not_null"}
    result = normalize_cohort_filters(filters)
    key = list(result.pheno_filters.compound[0].filters.keys())[0]
    if key == "participant$p131286":
        report("test_filter_rule_dot_notation", "pass", f"{key}")
    else:
        report(
            "test_filter_rule_dot_notation",
            "fail",
            f"expected participant$p131286, got {key}",
        )


def test_filter_rule_raw_field_raises():
    """单条 FilterRule 中裸字段名应抛出 DXCohortError。"""
    filters = {"field": "p131286", "operator": "is_not_null"}
    try:
        normalize_cohort_filters(filters)
        report("test_filter_rule_raw_field_raises", "fail", "expected DXCohortError")
    except DXCohortError as e:
        if "p131286" in str(e):
            report("test_filter_rule_raw_field_raises", "pass", str(e))
        else:
            report("test_filter_rule_raw_field_raises", "fail", f"wrong message: {e}")


# ── 端到端测试 ────────────────────────────────────────────────────────


def test_e2e_with_entity_prefix():
    """使用正确 entity.field 格式进行端到端 cohort 创建。"""
    try:
        client = DXClient(
            config=DXClientConfig(
                auth_token=__import__("os").getenv("DX_AUTH_TOKEN", ""),
                project_context_id=__import__("os").getenv("DX_PROJECT_CONTEXT_ID", ""),
            )
        )
        client.connect()
    except Exception as e:
        report("test_e2e_with_entity_prefix", "skip", f"connect: {e}")
        return

    cohort_name = f"_test_fix_{int(time.time())}"
    created_id: str | None = None

    try:
        filters = {
            "logic": "and",
            "pheno_filters": {
                "logic": "and",
                "compound": [
                    {
                        "filters": {
                            "participant.p31": [
                                {"condition": "is", "values": "Female"}
                            ],
                        },
                        "logic": "and",
                        "name": "phenotype",
                    }
                ],
            },
        }
        info = client.create_cohort(
            name=cohort_name,
            filters=filters,
            description="e2e test: entity.field format filter",
        )
        created_id = info.id
        report("test_e2e_with_entity_prefix", "pass", f"id={info.id}")
    except Exception as e:
        report("test_e2e_with_entity_prefix", "fail", f"{type(e).__name__}: {e}")
    finally:
        if created_id:
            try:
                client.delete_cohort(created_id)
                report("test_e2e cleanup", "pass", f"removed {created_id}")
            except Exception as e:
                report("test_e2e cleanup", "skip", str(e))
        client.disconnect()


def test_e2e_raw_field_rejected():
    """裸字段名在端到端调用中应被拒绝。"""
    try:
        client = DXClient(
            config=DXClientConfig(
                auth_token=__import__("os").getenv("DX_AUTH_TOKEN", ""),
                project_context_id=__import__("os").getenv("DX_PROJECT_CONTEXT_ID", ""),
            )
        )
        client.connect()
    except Exception as e:
        report("test_e2e_raw_field_rejected", "skip", f"connect: {e}")
        return

    try:
        filters = {
            "logic": "and",
            "pheno_filters": {
                "logic": "and",
                "compound": [
                    {
                        "filters": {"p131286": [{"condition": "exists", "values": []}]},
                        "logic": "and",
                        "name": "phenotype",
                    }
                ],
            },
        }
        client.create_cohort(name="_should_fail", filters=filters)
        report("test_e2e_raw_field_rejected", "fail", "expected DXCohortError")
    except DXCohortError as e:
        if "p131286" in str(e) and "entity" in str(e):
            report("test_e2e_raw_field_rejected", "pass", str(e))
        else:
            report("test_e2e_raw_field_rejected", "fail", f"wrong message: {e}")
    finally:
        client.disconnect()


# ═══════════════════════════════════════════════════════════════════════════


def main() -> None:
    print("=" * 70)
    print("  normalize_cohort_filters 测试")
    print("=" * 70)

    unit_tests = [
        test_raw_field_name_raises,
        test_normalize_dot_notation,
        test_normalize_already_dollar,
        test_normalize_multiple_keys,
        test_normalize_typed_vizphnofilters,
        test_rules_filter_dot_notation,
        test_rules_filter_raw_field_raises,
        test_filter_rule_dot_notation,
        test_filter_rule_raw_field_raises,
    ]

    print("\n── 单元测试 ──")
    for t in unit_tests:
        try:
            t()
        except Exception as e:
            report(t.__name__, "fail", f"unhandled: {e}\n{traceback.format_exc()}")

    print("\n── 端到端测试 ──")
    test_e2e_with_entity_prefix()
    test_e2e_raw_field_rejected()

    print("\n" + "=" * 70)
    print("  测试摘要")
    print("=" * 70)
    passed = sum(1 for _, s, _ in results if s == "pass")
    failed = sum(1 for _, s, _ in results if s == "fail")
    skipped = sum(1 for _, s, _ in results if s == "skip")
    print(
        f"  {PASS} {passed}   {FAIL} {failed}   {SKIP} {skipped}   total {len(results)}"
    )

    if failed:
        print("\n  失败项:")
        for name, status, detail in results:
            if status == "fail":
                print(f"    - {name}: {detail}")

    sys.exit(1 if failed else 0)


if __name__ == "__main__":
    main()
