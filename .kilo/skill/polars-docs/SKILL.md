---
name: polars-docs
description: >-
  This skill should be used when users ask about Polars Python API functionality,
  including DataFrame, LazyFrame, Series, expressions, or any other Polars-specific
  operations. Use when answering questions about Polars methods, parameters, or usage patterns.
---

# Polars Documentation Skill

Answer questions about Polars Python API by fetching the relevant documentation from `https://docs.pola.rs/api/python/stable/`.

## Documentation URLs

- **Main index**: `https://docs.pola.rs/api/python/stable/reference/index.html`
- **DataFrame**: `https://docs.pola.rs/api/python/stable/reference/dataframe/index.html`
- **LazyFrame**: `https://docs.pola.rs/api/python/stable/reference/lazyframe/index.html`
- **Series**: `https://docs.pola.rs/api/python/stable/reference/series/index.html`
- **SQL**: `https://docs.pola.rs/api/python/stable/reference/sql/index.html`

## API Structure (from references/polars_api_index.md)

The Polars API is organized into these main sections:

### DataFrame Operations
- **Aggregation**: count, max, max_horizontal, mean, mean_horizontal, median, min, min_horizontal, product, quantile, std, sum, sum_horizontal, var
- **Attributes**: columns, dtypes, flags, height, schema, shape, width
- **Descriptive**: approx_n_unique, describe, estimated_size, glimpse, is_duplicated, is_empty, is_unique, n_chunks, n_unique, null_count, show
- **Export**: to_arrow, to_dict, to_dicts, to_init_repr, to_jax, to_numpy, to_pandas, to_struct, to_torch, __array__, __dataframe__, __arrow_c_stream__
- **GroupBy**: agg, all, count, first, having, head, last, len, map_groups, max, mean, median, min, n_unique, quantile, sum, tail
- **Manipulation/selection**: bottom_k, cast, clear, clone, drop, drop_in_place, drop_nans, drop_nulls, explode, extend, fill_nan, fill_null, filter, gather_every, get_column, get_column_index, get_columns, group_by, group_by_dynamic, head, hstack, insert_column, interpolate, item, iter_columns, iter_rows, iter_slices, join, join_asof, join_where, limit, melt, merge_sorted, partition_by, pipe, pivot, rechunk, remove, rename, replace_column, reverse, rolling, row, rows, rows_by_key, sample, select, select_seq, set_sorted, shift, shrink_to_fit, slice, sort, sql, tail, to_dummies, to_series, top_k, transpose, unique, unnest, unpivot, unstack, update, upsample, vstack, with_columns, with_columns_seq, with_row_count, with_row_index
- **Miscellaneous**: collect_schema, corr, equals, lazy, map_columns, map_rows, deserialize, serialize

### LazyFrame Operations
- **Aggregation**: count, max, mean, median, min, null_count, quantile, std, sum, var
- **Attributes**: columns, dtypes, schema, width
- **Descriptive**: describe, explain, show_graph, show
- **GroupBy**: agg, all, count, first, having, head, last, len, map_groups, max, mean, median, min, n_unique, quantile, sum, tail
- **Manipulation/selection**: approx_n_unique, bottom_k, cast, clear, clone, drop, drop_nans, drop_nulls, explode, fill_nan, fill_null, filter, first, gather_every, group_by, group_by_dynamic, head, inspect, interpolate, join, join_asof, join_where, last, limit, match_to_schema, melt, merge_sorted, pivot, remove, rename, reverse, rolling, select, select_seq, set_sorted, shift, slice, sort, sql, tail, top_k, unique, unnest, unpivot, update, with_columns, with_columns_seq, with_context, with_row_count, with_row_index
- **Miscellaneous**: cache, collect, collect_async, collect_schema, collect_batches, sink_batches, lazy, map_batches, pipe, pipe_with_schema, profile, remote, deserialize, serialize

### Series Operations
- **Aggregation**: arg_max, arg_min, count, implode, max, max_by, mean, median, min, min_by, mode, nan_max, nan_min, product, quantile, std, sum, var
- **Array**: agg, all, any, arg_max, arg_min, contains, count_matches, explode, eval, first, get, join, last, len, max, mean, median, min, n_unique, reverse, shift, sort, std, sum, to_list, to_struct, unique, var
- **Attributes**: dtype, flags, name, shape
- **Binary**: contains, decode, encode, ends_with, get, head, reinterpret, size, slice, starts_with, tail
- **Boolean**: all, any, not_
- **Categories**: ends_with, get_categories, is_local, len_bytes, len_chars, starts_with, to_local, uses_lexical_ordering
- **Computation**: abs, arccos, arccosh, arcsin, arcsinh, arctan, arctanh, arg_true, arg_unique, approx_n_unique, bitwise_* operations, cbrt, cos, cosh, cot, cum_count, cum_max, cum_min, cum_prod, cum_sum, cumulative_eval, diff, dot, entropy, ewm_mean, ewm_mean_by, ewm_std, ewm_var, exp, first, hash, hist, index_of, is_between, is_close, kurtosis, last, log, log10, log1p, pct_change, peak_max, peak_min, rank, replace, replace_strict, rolling_*, sign, sin, sinh, skew, sqrt, tan, tanh
- **Descriptive**: chunk_lengths, describe, estimated_size, has_nulls, has_validity, is_duplicated, is_empty, is_finite, is_first_distinct, is_in, is_infinite, is_last_distinct, is_nan, is_not_nan, is_not_null, is_null, is_sorted, is_unique, len, lower_bound, n_chunks, n_unique, null_count, unique_counts, upper_bound, value_counts
- **Export**: to_arrow, to_frame, to_init_repr, to_jax, to_list, to_numpy, to_pandas, to_torch, __array__, __arrow_c_stream__
- **List**: agg, all, any, arg_max, arg_min, concat, contains, count_matches, diff, drop_nulls, eval, explode, filter, first, gather, gather_every, get, head, item, join, last, len, max, mean, median, min, n_unique, reverse, sample, set_difference, set_intersection, set_symmetric_difference, set_union, shift, slice, sort, std, sum, tail, to_array, to_struct, unique, var
- **Manipulation/selection**: alias, append, arg_sort, backward_fill, bottom_k, bottom_k_by, cast, ceil, clear, clip, clone, cut, drop_nans, drop_nulls, explode, extend, extend_constant, fill_nan, fill_null, filter, floor, forward_fill, gather, gather_every, head, interpolate, interpolate_by, item, limit, new_from_index, qcut, rechunk, rename, repeat_by, reshape, reverse, rle, rle_id, round, round_sig_figs, sample, scatter, set, shift, shrink_dtype, shrink_to_fit, shuffle, slice, sort, sql, tail, to_dummies, top_k, top_k_by, truncate, unique, zip_with
- **String**: str.concat and other string operations
- **Temporal**: dt.* operations for datetime handling

### Expressions (polars.expr)
- **Creation**: lit, col, format, datetime, date, time, etc.
- **Operations**: arithmetics, comparisons, logical operations

### Functions (polars)
- **DataFrame constructors**: DataFrame, LazyFrame, read_csv, read_parquet, read_json, etc.
- **Series constructors**: Series, is_in, concat, align_frames
- **SQL**: sql_context, sql

## Workflow

1. Identify the relevant Polars class (DataFrame, LazyFrame, Series, Expr) and method
2. Fetch the specific API documentation page using WebFetch
3. Parse the documentation to answer the user's question
4. Provide the method signature, parameters, return type, and usage example if available

## Documentation URL Pattern

Specific API pages follow this pattern:
```
https://docs.pola.rs/api/python/stable/reference/{category}/api/polars.{Class}.{method}.html
```

For example:
- DataFrame.filter: `https://docs.pola.rs/api/python/stable/reference/dataframe/api/polars.DataFrame.filter.html`
- Series.sort: `https://docs.pola.rs/api/python/stable/reference/series/api/polars.Series.sort.html`
- LazyFrame.collect: `https://docs.pola.rs/api/python/stable/reference/lazyframe/api/polars.LazyFrame.collect.html`
