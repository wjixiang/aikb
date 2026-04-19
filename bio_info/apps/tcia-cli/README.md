# tcia-cli

Command-line interface for [The Cancer Imaging Archive (TCIA)](https://www.cancerimagingarchive.net/). Query collections, patients, and DICOM series; download imaging data; and generate reports.

## Installation

```bash
pip install -e .
```

Requires Python 3.13+.

## Usage

```
tcia --help
```

### Collections

```bash
tcia collections list
tcia collections describe <name>
```

### Patients

```bash
tcia patients list -c <collection>
tcia patients by-modality -c <collection> -m <modality>
tcia patients new -c <collection> -d <YYYY/MM/DD>
```

### Series

```bash
tcia series list -c <collection> [-m <modality>] [-b <body-part>]
tcia series meta <series-uid>
tcia series size <series-uid>
tcia series sop <series-uid>
```

### Search

```bash
tcia search -c <collection> -m CT --from-date 2020/01/01 --limit 20
```

### Download

```bash
tcia download series <series-uid> [-o <output-dir>]
tcia download collection -c <collection> [-m <modality>] [-o <output-dir>]
tcia download image <series-uid> <sop-uid>
```

Use `--organize` (default) to arrange files as `Collection/Patient/Series/*.dcm`.

### Reports

```bash
tcia report doi <series-uid>...
tcia report collection -c <collection>
```

### DICOM

```bash
tcia dicom tags <series-uid>
tcia dicom seg-ref <series-uid>
```

## Output Formats

All commands support `--json` for JSON output.

## Resources

- [TCIA API Guides](https://wiki.cancerimagingarchive.net/display/Public/TCIA+Application+Programming+Interface+%28API%29+Guides)
