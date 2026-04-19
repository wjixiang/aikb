---
name: tcia-cli
description: This skill should be used when the user needs to interact with The Cancer Imaging Archive (TCIA) medical imaging database — querying collections, patients, series metadata, searching for imaging data by modality/body-part/manufacturer, downloading DICOM images, or generating DOI/collection reports.
---

# TCIA CLI Skill

## Overview

The tcia-cli tool provides a command-line interface for [The Cancer Imaging Archive (TCIA)](https://www.cancerimagingarchive.net/), a service that provides medical imaging data for cancer research. This skill covers querying, searching, downloading, and reporting workflows.

## When to Use This Skill

- Querying TCIA collections and their descriptions
- Listing patients within collections, filtered by modality or date
- Searching for series by collection, modality, body part, manufacturer, date range
- Downloading DICOM series or entire collections
- Generating DOI summary reports or collection summary reports
- Inspecting DICOM tags and SEG/RTSTRUCT references

## Tool Location

The CLI is located at `bio_info/apps/tcia-cli/`. To invoke commands, run from that directory or install with `pip install -e .` which creates the `tcia` command.

## Command Reference

### Collections

```bash
# List all collections
tcia collections list

# Show collection description and patient count
tcia collections describe <collection-name>
```

### Patients

```bash
# List patients in a collection
tcia patients list -c <collection>

# List patients by collection and modality
tcia patients by-modality -c <collection> -m <modality>

# List new patients added since a date
tcia patients new -c <collection> -d <YYYY/MM/DD>
```

### Series

```bash
# Query series with optional filters
tcia series list -c <collection> [-m <modality>] [-b <body-part>] [-p <patient-id>] [--manufacturer <name>] [--model <model>]

# Show detailed metadata for a series
tcia series meta <series-uid>

# Show file count and total size
tcia series size <series-uid>

# List SOP Instance UIDs in a series
tcia series sop <series-uid>
```

### Search

```bash
# Advanced search with multiple filters
tcia search -c <collection> -m CT --from-date 2020/01/01 --limit 20
tcia search -b Brain -m MR --manufacturer Siemens
```

Options:
- `-c/--collection`: Collection name(s)
- `-m/--modality`: Modality(ies) (CT, MR, PT, etc.)
- `-b/--body-part`: Body part(s) examined
- `--manufacturer`: Manufacturer(s)
- `--from-date` / `--to-date`: Date range (YYYY/MM/DD)
- `-p/--patient`: Patient ID(s)
- `--min-studies`: Minimum number of studies
- `-n/--limit`: Max results (default 10)
- `--offset`: Skip first N results

### Download

```bash
# Download one or more series
tcia download series <series-uid>... [-o <output-dir>] [--workers 10] [--number N] [--zip] [--hash]

# Download entire collection (prompts for confirmation)
tcia download collection -c <collection> [-m <modality>] [-o <output-dir>] [--workers 10] [--limit N] [--dry-run]

# Download single DICOM image
tcia download image <series-uid> <sop-uid>
```

Key options:
- `--organize` (default): Arranges files as `Collection/Patient/Series/*.dcm`
- `--zip`: Keep downloaded files as ZIP
- `--hash`: Verify with MD5 hash
- `--workers N`: Parallel download threads (default 10)
- `--dry-run`: Preview series to download without downloading

### Reports

```bash
# Generate DOI summary for series
tcia report doi <series-uid>...

# Generate collection summary report
tcia report collection -c <collection>
```

### DICOM

```bash
# Show DICOM tags for a series
tcia dicom tags <series-uid>

# Show reference series for a SEG or RTSTRUCT
tcia dicom seg-ref <series-uid>
```

## Output Formats

All commands support `--json` for JSON output instead of the default table format.

## Common Workflows

**Find all CT series in a collection and download the first 5:**
```bash
tcia series list -c <collection> -m CT --limit 5
# Copy the SeriesInstanceUIDs, then:
tcia download series <uid1> <uid2> <uid3> <uid4> <uid5>
```

**Download an entire collection:**
```bash
tcia download collection -c <collection> --dry-run  # Preview first
tcia download collection -c <collection>  # Confirm when ready
```

**Search for Siemens MR data:**
```bash
tcia search -m MR --manufacturer Siemens --limit 50
```

## Resources

- [TCIA API Guides](https://wiki.cancerimagingarchive.net/display/Public/TCIA+Programmatic+Interface+API+Guides)
- Tool source: `bio_info/apps/tcia-cli/`
