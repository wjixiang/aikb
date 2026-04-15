# Polars Python API Index

Source: https://docs.pola.rs/api/python/stable/reference/index.html

## Main Classes

- **DataFrame** - Two-dimensional data structure with named columns
- **LazyFrame** - Lazy version of DataFrame for query optimization
- **Series** - One-dimensional data structure
- **Expr** - Expression for lazy operations
- **LazyGroupBy** - GroupBy for LazyFrame

## DataFrame Categories

### Aggregation
count, max, max_horizontal, mean, mean_horizontal, median, min, min_horizontal, product, quantile, std, sum, sum_horizontal, var

### Attributes  
columns, dtypes, flags, height, schema, shape, width

### Computation
fold, hash_rows

### Descriptive
approx_n_unique, describe, estimated_size, glimpse, is_duplicated, is_empty, is_unique, n_chunks, n_unique, null_count, show

### Export
__array__, __arrow_c_stream__, __dataframe__, to_arrow, to_dict, to_dicts, to_init_repr, to_jax, to_numpy, to_pandas, to_struct, to_torch

### GroupBy
__iter__, agg, all, count, first, having, head, last, len, map_groups, max, mean, median, min, n_unique, quantile, sum, tail

### Manipulation/selection
__getitem__, __setitem__, bottom_k, cast, clear, clone, drop, drop_in_place, drop_nans, drop_nulls, explode, extend, fill_nan, fill_null, filter, gather_every, get_column, get_column_index, get_columns, group_by, group_by_dynamic, head, hstack, insert_column, interpolate, item, iter_columns, iter_rows, iter_slices, join, join_asof, join_where, limit, match_to_schema, melt, merge_sorted, partition_by, pipe, pivot, rechunk, remove, rename, replace_column, reverse, rolling, row, rows, rows_by_key, sample, select, select_seq, set_sorted, shift, shrink_to_fit, slice, sort, sql, tail, to_dummies, to_series, top_k, transpose, unique, unnest, unpivot, unstack, update, upsample, vstack, with_columns, with_columns_seq, with_row_count, with_row_index

### Miscellaneous
collect_schema, corr, equals, lazy, map_columns, map_rows, deserialize, serialize

### Plot
plot

### Style
style

## LazyFrame Categories

### Aggregation
count, max, mean, median, min, null_count, quantile, std, sum, var

### Attributes
columns, dtypes, schema, width

### Descriptive
describe, explain, show_graph, show

### GroupBy
agg, all, count, first, having, head, last, len, map_groups, max, mean, median, min, n_unique, quantile, sum, tail

### Manipulation/selection
__getitem__, approx_n_unique, bottom_k, cast, clear, clone, drop, drop_nans, drop_nulls, explode, fill_nan, fill_null, filter, first, gather_every, group_by, group_by_dynamic, head, inspect, interpolate, join, join_asof, join_where, last, limit, match_to_schema, melt, merge_sorted, pivot, remove, rename, reverse, rolling, select, select_seq, set_sorted, shift, slice, sort, sql, tail, top_k, unique, unnest, unpivot, update, with_columns, with_columns_seq, with_context, with_row_count, with_row_index

### Miscellaneous
cache, collect, collect_async, collect_schema, collect_batches, sink_batches, lazy, map_batches, pipe, pipe_with_schema, profile, remote, deserialize, serialize

### InProcessQuery
cancel, fetch, fetch_blocking

### GPUEngine
GPUEngine

## Series Categories

### Aggregation
arg_max, arg_min, count, implode, max, max_by, mean, median, min, min_by, mode, nan_max, nan_min, product, quantile, std, sum, var

### Array
agg, all, any, arg_max, arg_min, contains, count_matches, explode, eval, first, get, join, last, len, max, mean, median, min, n_unique, reverse, shift, sort, std, sum, to_list, to_struct, unique, var

### Attributes
dtype, flags, name, shape

### Binary
contains, decode, encode, ends_with, get, head, reinterpret, size, slice, starts_with, tail

### Boolean
all, any, not_

### Categories
ends_with, get_categories, is_local, len_bytes, len_chars, starts_with, to_local, uses_lexical_ordering

### Computation
abs, arccos, arccosh, arcsin, arcsinh, arctan, arctanh, arg_true, arg_unique, approx_n_unique, bitwise_count_ones, bitwise_count_zeros, bitwise_leading_ones, bitwise_leading_zeros, bitwise_trailing_ones, bitwise_trailing_zeros, bitwise_and, bitwise_or, bitwise_xor, cbrt, cos, cosh, cot, cum_count, cum_max, cum_min, cum_prod, cum_sum, cumulative_eval, diff, dot, entropy, ewm_mean, ewm_mean_by, ewm_std, ewm_var, exp, first, hash, hist, index_of, is_between, is_close, kurtosis, last, log, log10, log1p, pct_change, peak_max, peak_min, rank, replace, replace_strict, rolling_kurtosis, rolling_map, rolling_max, rolling_max_by, rolling_mean, rolling_mean_by, rolling_median, rolling_median_by, rolling_min, rolling_min_by, rolling_quantile, rolling_quantile_by, rolling_rank, rolling_rank_by, rolling_skew, rolling_std, rolling_std_by, rolling_sum, rolling_sum_by, rolling_var, rolling_var_by, search_sorted, sign, sin, sinh, skew, sqrt, tan, tanh

### Descriptive
chunk_lengths, describe, estimated_size, has_nulls, has_validity, is_duplicated, is_empty, is_finite, is_first_distinct, is_in, is_infinite, is_last_distinct, is_nan, is_not_nan, is_not_null, is_null, is_sorted, is_unique, len, lower_bound, n_chunks, n_unique, null_count, unique_counts, upper_bound, value_counts

### Export
__array__, __arrow_c_stream__, to_arrow, to_frame, to_init_repr, to_jax, to_list, to_numpy, to_pandas, to_torch

### Extension Types
ext.storage, ext.to

### List
agg, all, any, arg_max, arg_min, concat, contains, count_matches, diff, drop_nulls, eval, explode, filter, first, gather, gather_every, get, head, item, join, last, len, max, mean, median, min, n_unique, reverse, sample, set_difference, set_intersection, set_symmetric_difference, set_union, shift, slice, sort, std, sum, tail, to_array, to_struct, unique, var

### Manipulation/selection
__getitem__, alias, append, arg_sort, backward_fill, bottom_k, bottom_k_by, cast, ceil, clear, clip, clone, cut, drop_nans, drop_nulls, explode, extend, extend_constant, fill_nan, fill_null, filter, floor, forward_fill, gather, gather_every, head, interpolate, interpolate_by, item, limit, new_from_index, qcut, rechunk, rename, repeat_by, reshape, reverse, rle, rle_id, round, round_sig_figs, sample, scatter, set, shift, shrink_dtype, shrink_to_fit, shuffle, slice, sort, sql, tail, to_dummies, top_k, top_k_by, truncate, unique, zip_with

### Operators
eq, eq_missing, ge, gt, le, lt, ne, ne_missing, pow

### Plot
plot

### String
str.concat, str.contains, str.strip, str.replace, etc. (see full list in docs)

### Temporal (dt.*)
dt.year, dt.month, dt.day, dt.hour, dt.minute, dt.second, dt.nanosecond, dt.ordinal_day, dt.date, dt.time, dt.datetime, dt.timestamp, dt.epoch, dt.round, dt.strftime, dt.str_parse, dt.days, dt.hours, dt.minutes, dt.seconds, dt.milliseconds, dt.microseconds, dt.nanoseconds, dt.offset_by, dt.combine, dt.month_start, dt.month_end, dt.quarter_start, dt.quarter_end, dt.year_start, dt.year_end, dt.week_start, dt.week_end, dt.business_day_start, dt.business_day_end, dt.is_leap_year, dt.is_month_start, dt.is_month_end, dt.is_quarter_start, dt.is_quarter_end, dt.is_year_start, dt.is_year_end, dt.is_weekday, dt.is_weekend, dt.timeline_sort, dt.timeline_join, dt.as_duration, dt.to_python_datetime, dt.to_python_timedelta

## Expr Methods

### Creation
lit, col, format, datetime, date, time, coalesce, fold, element, any, all,饱和

### Arithmetics
+, -, *, /, %, **, abs, sign, pow, log, log10, log1p, exp, sqrt, cbrt, floor, ceil, round, round_sig_figs, trunc

### Comparisons
==, !=, <, <=, >, >=, eq, ne, lt, le, gt, ge, is_in, is_null, is_not_null, is_nan, is_not_nan, is_first_distinct, is_last_distinct, is_between, is_duplicated, is_unique

### Strings
str.contains, str.strip, str.rstrip, str.lstrip, str.replace, str.replace_all, str.to_lowercase, str.to_uppercase, str.capitalize, str.titlecase, str.len_bytes, str.len_chars, str.strip_prefix, str.strip_suffix, str.startswith, str.endswith, str.extract, str.extract_all, str.split, str.split_exact, str.splitn, str.rjust, str.ljust, str.zfill, str.contains_many, str.replace_many

### Temporal
dt.year, dt.month, dt.day, dt.hour, dt.minute, dt.second, dt.nanosecond, dt.microsecond, dt.millisecond, dt.ordinal_day, dt.date, dt.time, dt.datetime, dt.timestamp, dt.epoch, dt.round, dt.strftime, dt.strptime, dt.offset_by, dt.combine, dt.month_start, dt.month_end, dt.quarter_start, dt.quarter_end, dt.year_start, dt.year_end, dt.week_start, dt.week_end

### Aggregations
sum, mean, median, min, max, count, n_unique, first, last, lit, agg, fold, std, var, skew, kurtosis, product, log, log10, log1p, exp, sqrt, abs, sign, pow, floor, ceil, round, trunc, sin, cos, tan, asin, acos, atan, sinh, cosh, tanh, asinh, acosh, atanh, degrees, radians

### Rolling
rolling_* (rolling_sum, rolling_mean, rolling_min, rolling_max, rolling_std, rolling_var, rolling_median, rolling_quantile, rolling_skew, rolling_kurtosis, rolling_map)

### Window
rank, dense_rank, percent_rank, cum_sum, cum_prod, cum_count, cum_max, cum_min, cum_mean, cum_median, cum_std, cum_var, shift, drop_nulls, fill_null, fill_nan, interpolate, rolling, exploding, implode, sort, argsort, unique, unique_counts, top_k, bottom_k, arg_max, arg_min, search_sorted, approximate_top_k, quantile, approx_n_unique, all, any, none

## Polars Functions

### DataFrame I/O
DataFrame, LazyFrame, read_csv, read_csv_batched, scan_csv, read_parquet, scan_parquet, read_json, read_ndjson, scan_json, scan_ndjson, read_ipc, scan_ipc, read_database, read_database_schema, read_excel, read_excel_batch, read_ods, read_html, read_pyarrow_dataset, read_delta, read_spark_connector, read_libavro, read_avro, read_xml, read_clipboard, read_clipboard_board

### Series I/O
Series, is_in, concat, align_frames

### SQL
sql, sql_context

### Utilities
explain, docstring, show_versions, enable_string_cache, disable_string_cache, threadpool_size, collect_all, lazy_functions, selectors, build_info, toggle_string_cache

### Config
Config, ConfigBuilder

### Exceptions
PolarsError, ModuleNotFoundError, ColumnNotFoundError, ComputeError, NoDataError, InvalidOperationError, PolarsPanicError, PolarsWarning, DeprecationWarning
