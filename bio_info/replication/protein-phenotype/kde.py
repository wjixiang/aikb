from plotnine import (
    ggplot,
    aes,
    geom_density,
    labs,
    theme_minimal,
    theme,
    element_text,
    element_rect,
    element_line,
    scale_fill_manual,
    guides,
)


def draw_kde(df):
    ace_pht_df = df.select("eid", "ace2", "hpt")

    ace_pht_pd_df = ace_pht_df.collect()

    custom_colors = {False: "#18F6CA", True: "#FF0000"}

    base_plot = (
        ggplot(ace_pht_pd_df, aes(x="ace2", fill="hpt"))
        + geom_density(alpha=0.6, color="white", size=0.3)
        + labs(
            title="ACE2 Density Distribution by Hypertension Status",
            x="ACE2 Expression Level",
            y="Density",
            fill="Hypertension",
        )
        + theme_minimal()
        + theme(
            figure_size=(10, 6),
            text=element_text(family="DejaVu Sans", size=11),
            plot_title=element_text(size=16, weight="bold", ha="center"),
            axis_title=element_text(size=12, weight="bold"),
            axis_text=element_text(size=10),
            panel_grid_major=element_line(color="#E0E0E0", size=0.3),
            panel_grid_minor=element_line(color="#F0F0F0", size=0.2),
            legend_position="right",
            legend_key=element_rect(fill="white", color="white"),
            plot_background=element_rect(fill="white", color=None),
            panel_background=element_rect(fill="white", color="#E0E0E0"),
        )
        + scale_fill_manual(values=custom_colors)
        + guides(fill="legend")
    )

    return base_plot
