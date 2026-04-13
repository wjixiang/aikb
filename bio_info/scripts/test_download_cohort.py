"""测试 preview_cohort_data 功能。"""

from dx_client import DXClient


def main():
    cohort_id = "record-J7JbJJjJj70bf1QgJ3yqgPf7"

    client = DXClient()
    client.connect()
    print("Connected, project:", client.current_project_id)

    try:
        df = client.preview_cohort_data(cohort_id)
        print(f"Shape: {df.shape}")
        print(f"Columns: {df.columns.tolist()}")
        if not df.empty:
            print(df.head())
        else:
            print("Empty DataFrame — cohort has no details.fields")
    except Exception as e:
        import traceback

        traceback.print_exc()
    finally:
        client.disconnect()


if __name__ == "__main__":
    main()
