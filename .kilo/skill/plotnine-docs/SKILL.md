---
name: plotnine-docs
description: This skill should be used when users ask about plotnine Python visualization library API, creating plots with the grammar of graphics, mapping aesthetics to data, adding geoms/stats/facets/scales/themes, or any plotnine-specific functionality. Use when users want to create, customize, or understand statistical visualizations using plotnine (the Python equivalent of ggplot2).
---

# Plotnine Documentation Skill

## Overview

Plotnine is a Python implementation of the grammar of graphics, providing a consistent API for creating statistical visualizations. This skill provides access to the complete plotnine API reference for creating plots, mapping aesthetics, adding layers, and customizing visual appearance.

## Quick Start

To create a basic plotnine plot:

```python
from plotnine import ggplot, aes, geom_point

(ggplot(mtcars, aes('weight', 'mpg'))
 + geom_point())
```

## Creating a Plot

### Core Functions

- `ggplot(data, mapping)` - Create a new ggplot object
- `qplot(x, y, data)` - Quick plot (similar to ggplot2 qplot)
- `watermark(label)` - Add watermark to plot
- `save_as_pdf_pages(plots)` - Save multiple ggplot objects to PDF

### Aesthetic Mapping

- `aes(x, y, ...)` - Create aesthetic mappings
- `after_stat(x)` - Evaluate mapping after statistic calculation
- `after_scale(x)` - Evaluate mapping after variable mapped to scale
- `stage(...)` - Evaluate mapping at multiple stages

### Aesthetic Evaluation Helpers

- `factor(x)` - Convert to categorical variable
- `reorder(x, y)` - Reorder categorical by sorting along another variable

## Geoms

Geoms determine the visual representation of data points.

### Basic Geoms

| Function | Description |
|----------|-------------|
| `geom_point()` | Scatter plot |
| `geom_line()` | Connected points |
| `geom_path()` | Connected points (order preserved) |
| `geom_bar()` | Bar plot |
| `geom_col()` | Bar plot with base on x-axis |
| `geom_area()` | Area plot |
| `geom_histogram()` | Histogram |
| `geom_density()` | Smooth density estimate |
| `geom_boxplot()` | Box and whiskers plot |
| `geom_violin()` | Violin plot |
| `geom_text()` | Text annotations |
| `geom_label()` | Text with background |

### Line Geoms

| Function | Description |
|----------|-------------|
| `geom_abline()` | Lines by slope and intercept |
| `geom_hline()` | Horizontal line |
| `geom_vline()` | Vertical line |
| `geom_smooth()` | Smoothed conditional mean |
| `geom_quantile()` | Quantile regression lines |
| `geom_step()` | Stepped connected points |

### Interval Geoms

| Function | Description |
|----------|-------------|
| `geom_errorbar()` | Vertical interval as errorbar |
| `geom_errorbarh()` | Horizontal interval as errorbar |
| `geom_crossbar()` | Vertical interval as crossbar |
| `geom_linerange()` | Vertical interval as lines |
| `geom_pointrange()` | Line with point at center |

### Distribution Geoms

| Function | Description |
|----------|-------------|
| `geom_density_2d()` | 2D density estimate |
| `geom_bin_2d()` | Heatmap of 2d bin counts |
| `geom_freqpoly()` | Frequency polygon |
| `geom_dotplot()` | Dot plot |
| `geom_qq()` | Quantile-Quantile plot |
| `geom_qq_line()` | Q-Q plot with line |

### Map/Shape Geoms

| Function | Description |
|----------|-------------|
| `geom_map()` | Draw map feature |
| `geom_polygon()` | Filled polygon path |
| `geom_rect()` | Rectangles |
| `geom_tile()` | Rectangles using center points |
| `geom_raster()` | Rasterized rectangles |
| `geom_ribbon()` | Ribbon plot |

### Other Geoms

| Function | Description |
|----------|-------------|
| `geom_jitter()` | Scatter plot with jittered points |
| `geom_count()` | Plot overlapping points |
| `geom_sina()` | Sina plot |
| `geom_spoke()` | Line segment by location/direction |
| `geom_segment()` | Line segments |
| `geom_rug()` | Marginal rug plot |
| `geom_blank()` | Empty plot |
| `geom_pointdensity()` | Scatter with density at each point |

### Annotations

- `annotate(kind, ...)` - Create annotation layer
- `annotation_logticks()` - Marginal log ticks
- `annotation_stripes()` - Alternating stripes
- `arrow()` - Define arrowhead

### Labels

- `labs(x, y, color, fill, ...)` - Add labels for any aesthetics
- `xlab(label)` - X-axis label
- `ylab(label)` - Y-axis label
- `ggtitle(label)` - Plot title

## Stats

Stats perform aggregations and computations on data before drawing.

### Binning Stats

| Function | Description |
|----------|-------------|
| `stat_bin()` | Count cases in intervals |
| `stat_bin_2d()` | 2D bin counts |
| `stat_bindot()` | Binning for dot plot |

### Distribution Stats

| Function | Description |
|----------|-------------|
| `stat_density()` | Compute density estimate |
| `stat_density_2d()` | 2D kernel density estimation |
| `stat_ecdf()` | Empirical cumulative density |
| `stat_ellipse()` | Normal confidence ellipse |

### Summary Stats

| Function | Description |
|----------|-------------|
| `stat_summary()` | Summary statistics by x |
| `stat_summary_bin()` | Summarise y at x intervals |
| `stat_boxplot()` | Compute boxplot statistics |
| `stat_count()` | Count cases at each x position |

### Regression Stats

| Function | Description |
|----------|-------------|
| `stat_smooth()` | Smoothed conditional mean |
| `stat_quantile()` | Quantile regression lines |
| `stat_function()` | Superimpose function |
| `stat_qq()` | Quantile-quantile calculation |
| `stat_qq_line()` | Line through Q-Q plot |

### Other Stats

| Function | Description |
|----------|-------------|
| `stat_identity()` | Do nothing statistic |
| `stat_unique()` | Remove duplicates |
| `stat_sum()` | Sum unique values |
| `stat_hull()` | 2D convex hull |

## Facets

Facets subset data and plot on different panels.

- `facet_grid()` - Wrap 1D panels onto 2D surface
- `facet_wrap()` - Wrap 1D panels onto 2D surface
- `facet_null()` - Single panel

### Labellers

- `labeller(...)` - Facet strip labelling
- `as_labeller(x)` - Coerce to labeller
- `label_value()` - Keep value as label
- `label_both()` - Concatenate facet variable with value
- `label_context()` - Unambiguous label string

## Scales

Scales control mapping from data to aesthetics.

### Position Scales

**Continuous:**
- `scale_x_continuous()`, `scale_y_continuous()` - Continuous position
- `scale_x_log10()`, `scale_y_log10()` - Log10 transformed
- `scale_x_reverse()`, `scale_y_reverse()` - Reverse transformed
- `scale_x_sqrt()`, `scale_y_sqrt()` - Sqrt transformed
- `scale_x_symlog()`, `scale_y_symlog()` - Symmetric log transformed
- `scale_x_datetime()`, `scale_y_datetime()` - Datetime data
- `scale_x_timedelta()`, `scale_y_timedelta()` - Timedelta data

**Discrete:**
- `scale_x_discrete()`, `scale_y_discrete()` - Discrete position

### Color Scales

**Continuous:**
- `scale_color_gradient()` - 2 point color gradient
- `scale_color_gradient2()` - 3 point diverging gradient
- `scale_color_gradientn()` - N point gradient
- `scale_color_cmap()` - Matplotlib colormap
- `scale_color_desaturate()` - Desaturated gradient

**Discrete:**
- `scale_color_hue()` - Evenly spaced hues
- `scale_color_brewer()` - ColorBrewer scales
- `scale_color_grey()`, `scale_color_gray()` - Sequential grey

### Fill Scales

Same variants as color scales with `fill_` prefix.

### Alpha Scales

- `scale_alpha()` - Continuous alpha
- `scale_alpha_continuous()` - Continuous alpha (alias)
- `scale_alpha_datetime()` - Datetime alpha
- `scale_alpha_discrete()` - Discrete alpha
- `scale_alpha_ordinal()` - Ordinal alpha

### Size Scales

- `scale_size()` - Continuous area size
- `scale_size_area()` - Area size (no zero)
- `scale_size_radius()` - Radius size
- `scale_size_discrete()` - Discrete size
- `scale_size_datetime()` - Datetime size

### Shape & Linetype Scales

- `scale_shape()` - Shape/size for points
- `scale_linetype()` - Line patterns

### Manual Scales

- `scale_color_manual()` - Custom discrete colors
- `scale_fill_manual()` - Custom discrete fills
- `scale_alpha_manual()` - Custom discrete alpha
- `scale_linetype_manual()` - Custom linetypes
- `scale_shape_manual()` - Custom shapes
- `scale_size_manual()` - Custom sizes

### Identity Scales

No scaling: `scale_color_identity()`, `scale_fill_identity()`, `scale_alpha_identity()`, `scale_linetype_identity()`, `scale_shape_identity()`, `scale_size_identity()`, `scale_stroke_identity()`

### Scale Limits

- `lims(**kwargs)` - Set aesthetic limits
- `xlim(left, right)` - X-axis limits
- `ylim(bottom, top)` - Y-axis limits
- `expand_limits()` - Expand limits using data

## Guides

Guides interpret data on scales.

- `guides(**kwargs)` - Create guides for each scale
- `guide_legend()` - Legend guide
- `guide_colorbar()` - Colorbar guide

## Positions

Position adjustments for overlapping objects.

- `position_dodge()` - Dodge side-by-side
- `position_dodge2()` - Dodge (different algorithm)
- `position_fill()` - Normalize to unit height
- `position_identity()` - No adjustment
- `position_jitter()` - Jitter to avoid overplotting
- `position_jitterdodge()` - Dodge and jitter
- `position_nudge()` - Nudge points
- `position_stack()` - Stack on top

## Themes

Themes control non-data visual appearance.

### Pre-built Themes

- `theme_gray()`, `theme_grey()` - Gray background with white gridlines
- `theme_bw()` - White background with black gridlines
- `theme_classic()` - Classic with axis lines, no gridlines
- `theme_minimal()` - Minimal with no background
- `theme_void()` - Empty, only data
- `theme_light()` - Light theme
- `theme_dark()` - Dark theme
- `theme_linedraw()` - Only black lines on white
- `theme_matplotlib()` - Matplotlib look
- `theme_seaborn()` - Seaborn style
- `theme_538()` - FiveThirtyEight style
- `theme_tufte()` - Tufte maximal data theme
- `theme_xkcd()` - XKCD hand-drawn style

### Theme Modification

- `theme_set(theme)` - Change default theme
- `theme_get()` - Get current default theme
- `theme_update(**kwargs)` - Modify theme elements

### Theme Elements

- `element_line()` - Line element
- `element_rect()` - Rectangle element
- `element_text()` - Text element
- `element_blank()` - Blank element

### Themeable Properties

**Axis:**
`axis_line`, `axis_line_x`, `axis_line_y`, `axis_text`, `axis_text_x`, `axis_text_y`, `axis_ticks`, `axis_ticks_major`, `axis_ticks_minor`, `axis_ticks_x`, `axis_ticks_y`, `axis_ticks_length`, `axis_ticks_major_x`, `axis_ticks_major_y`, `axis_ticks_minor_x`, `axis_ticks_minor_y`, `axis_title`, `axis_title_x`, `axis_title_y`

**Panel:**
`panel_background`, `panel_border`, `panel_grid`, `panel_grid_major`, `panel_grid_major_x`, `panel_grid_major_y`, `panel_grid_minor`, `panel_grid_minor_x`, `panel_grid_minor_y`, `panel_ontop`, `panel_spacing`, `panel_spacing_x`, `panel_spacing_y`

**Legend:**
`legend_background`, `legend_box`, `legend_box_background`, `legend_box_just`, `legend_box_margin`, `legend_box_spacing`, `legend_direction`, `legend_frame`, `legend_justification`, `legend_justification_bottom`, `legend_justification_inside`, `legend_justification_left`, `legend_justification_right`, `legend_justification_top`, `legend_key`, `legend_key_height`, `legend_key_size`, `legend_key_spacing`, `legend_key_spacing_x`, `legend_key_spacing_y`, `legend_key_width`, `legend_margin`, `legend_position`, `legend_position_inside`, `legend_spacing`, `legend_text`, `legend_text_colorbar`, `legend_text_legend`, `legend_text_position`, `legend_ticks`, `legend_ticks_length`, `legend_title`, `legend_title_position`

**Plot:**
`plot_background`, `plot_caption`, `plot_caption_position`, `plot_margin`, `plot_margin_bottom`, `plot_margin_left`, `plot_margin_right`, `plot_margin_top`, `plot_subtitle`, `plot_tag`, `plot_tag_location`, `plot_tag_position`, `plot_title`, `plot_title_position`

**Other:**
`aspect_ratio`, `dpi`, `figure_size`, `line`, `rect`, `strip_align`, `strip_align_x`, `strip_align_y`, `strip_background`, `strip_background_x`, `strip_background_y`, `strip_text`, `strip_text_x`, `strip_text_y`, `svg_usefonts`, `text`, `title`

## Coordinates

Coordinate systems produce 2D locations from position scales.

- `coord_cartesian()` - Cartesian coordinates
- `coord_equal()` - Fixed x/y relationship
- `coord_fixed()` - Fixed x/y relationship
- `coord_flip()` - Flipped cartesian
- `coord_trans()` - Transformed cartesian

## Composing Plots

- `Compose` - Base class for compositions
- `plot1 / plot2` - Stack plots vertically
- `plot1 | plot2` - Place plots side by side
- `plot_spacer()` - Blank area

## Options

Package options for interactive use.

- `get_option(name)` - Get package option
- `set_option(name, value)` - Set package option

### Available Options

- `aspect_ratio` - Default aspect ratio for themes
- `base_family` - Base font family
- `base_margin` - Proportional margin size
- `current_theme` - Theme used when none added
- `dpi` - Default DPI
- `figure_size` - Default figure size in inches
- `figure_format` - Inline figure format for Jupyter

## Tools

- `get_aesthetic_limits()` - Get limits of an aesthetic

## Datasets

Import datasets from `plotnine.data`:

- `anscombe_quartet` - Anscombe's Quartet
- `diamonds` - 50,000 round cut diamonds
- `economics` - US economic time series
- `economics_long` - US economic time series (long format)
- `faithful` - Old Faithful Geyser data
- `faithfuld` - Old Faithful Geyser data (density)
- `huron` - Lake Huron level 1875-1972
- `luv_colours` - Colors in Luv space
- `meat` - US Meat Production
- `midwest` - Midwest demographics
- `mpg` - Fuel economy 1999/2008 for 38 car models
- `msleep` - Mammals sleep dataset
- `mtcars` - Motor Trend Car Road Tests
- `pageviews` - Web page views
- `penguins` - Palmer Penguins data
- `presidential` - Presidents Eisenhower to Obama
- `seals` - Seal movement vector field
- `txhousing` - Texas housing sales

## Common Patterns

### Basic Scatter Plot
```python
from plotnine import ggplot, aes, geom_point

ggplot(mtcars, aes('weight', 'mpg')) + geom_point()
```

### Grouped Scatter with Color
```python
from plotnine import ggplot, aes, geom_point, scale_color_brewer

ggplot(mtcars, aes('weight', 'mpg', color='factor(cyl)')) + geom_point()
```

### Box Plot with Theme
```python
from plotnine import ggplot, aes, geom_boxplot, theme_minimal

(ggplot(mpg, aes('class', 'hwy'))
 + geom_boxplot()
 + theme_minimal())
```

### Faceted Plot
```python
from plotnine import ggplot, aes, geom_point, facet_wrap

(ggplot(mpg, aes('displ', 'hwy'))
 + geom_point()
 + facet_wrap('~class'))
```

### With Statistics
```python
from plotnine import ggplot, aes, geom_point, stat_smooth

(ggplot(mpg, aes('displ', 'hwy'))
 + geom_point()
 + stat_smooth(method='lm'))
```
