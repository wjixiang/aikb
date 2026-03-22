import pandas as pd


def is_year(val):
    """判断是否为有效年份（4位数字）"""
    try:
        var_str = str(val).strip()
        if '.' in var_str:
            # 去掉小数点后的部分
            var_str = var_str.split('.')[0]
        if var_str.isdigit() and len(var_str) == 4:
            # 可选：添加年份范围验证
            year = int(var_str)
            return 1900 <= year <= 2030
        return False
    except Exception as e:
        return False


def check_first_column(df: pd.DataFrame):
    """检查第一列的基本信息"""
    col = df.columns[0]  # 第一列列名
    data = df[col]

    print(f"列名: {col}")
    print(f"数据类型: {data.dtype}")
    print(f"非空数量: {data.notna().sum()} / {len(data)}")
    print(f"空值数量: {data.isna().sum()}")
    
    # 显示前几个值作为示例
    print(f"\n前10个值:")
    for i, val in enumerate(data.head(10)):
        print(f"  {i}: {val} (类型: {type(val).__name__})")


def main():
    # 读取Excel文件
    df = pd.read_excel("./data2.xlsx")
    
    print("原始DataFrame信息:")
    print(f"形状: {df.shape}")
    print(f"列名: {df.columns.tolist()}")
    print("\n前5行数据:")
    print(df.head())
    print("\n" + "=" * 50)
    
    # 检查第一列信息
    check_first_column(df)
    print("\n" + "=" * 50)
    
    # 方法1：使用列表收集数据（推荐，性能好）
    clean_rows = []  # 收集符合条件的行
    invalid_rows = []  # 收集不符合条件的行
    
    for index, row in df.iterrows():
        first_col_value = str(row.iloc[0]).strip()  # 获取第一列的值
        
        if is_year(first_col_value):
            row.iloc[0] = int(str(row.iloc[0]).split('.')[0])
            # 如果是年份，添加到清洗数据中
            clean_rows.append(row.to_dict())  # 将行转换为字典
            print(f"✓ 第{index}行: {first_col_value} - 有效年份")
        else:
            # 如果不是年份，记录但不添加
            invalid_rows.append({
                'index': index,
                'value': first_col_value,
                'row_data': row.to_dict()
            })
            print(f"✗ 第{index}行: {first_col_value} - 无效年份")
    
    # 创建清洗后的DataFrame
    if clean_rows:
        clean_df = pd.DataFrame(clean_rows)
        print(f"\n成功筛选 {len(clean_df)} 行有效年份数据")
    else:
        clean_df = pd.DataFrame()
        print("\n没有找到有效年份数据")
    
    # 输出无效年份统计
    if invalid_rows:
        print(f"\n发现 {len(invalid_rows)} 行无效年份数据:")
        for inv in invalid_rows[:10]:  # 只显示前10个
            print(f"  索引{inv['index']}: '{inv['value']}'")
    
    print("\n" + "=" * 50)
    print("清洗后的数据:")
    print(clean_df.head())
    print(f"\n清洗后数据形状: {clean_df.shape}")
    
    # 可选：保存清洗后的数据
    if not clean_df.empty:
        clean_df.to_csv("./zj-clean.csv", index=False)
        print("\n已保存到: ./zj-clean.csv")
    
    return clean_df


if __name__ == "__main__":
    clean_data = main()