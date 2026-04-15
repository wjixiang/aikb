# UK Biobank Field Codes Reference

Common UK Biobank field codes for clinical research.

## Demographics

| Field | Name | Type | Description |
|-------|------|------|-------------|
| p31 | Sex | integer | 0=Male, 1=Female |
| p21003_i0 | Age at assessment | integer | First occurrence, use `_i0` index for arrays |
| p21003 | Age at assessment | array | All occurrences |
| p189 | Townsend deprivation index | integer | Area-level deprivation score |
| p738 | Education | integer | Qualifications |

## Anthropometry

| Field | Name | Type | Description |
|-------|------|------|-------------|
| p21001 | Body mass index (BMI) | integer | kg/m² |
| p23099 | Waist circumference | integer | cm |
| p23100 | Hip circumference | integer | cm |
| p23104 | Standing height | integer | cm |
| p23105 | Sitting height | integer | cm |
| p23106 | Trunk height | integer | cm |
| p23107 | Leg height | integer | cm |
| p23110 | Predicted weight | integer | kg |
| p23111 | Predicted height | integer | cm |

## Blood Pressure

| Field | Name | Type | Description |
|-------|------|------|-------------|
| p4080 | Systolic blood pressure, manual | integer | mmHg |
| p4080_i0 | Systolic BP (first reading) | integer | |
| p4079 | Diastolic blood pressure, manual | integer | mmHg |
| p94 | Systolic blood pressure, automated | integer | mmHg |
| p94_i0 | Automated systolic BP (first) | integer | |
| p93 | Diastolic blood pressure, automated | integer | mmHg |

## Biochemistry

### Blood
| Field | Name | Type | Description |
|-------|------|------|-------------|
| p30710 | HDL cholesterol | integer | mmol/L |
| p30730 | LDL cholesterol | integer | mmol/L |
| p30690 | Total cholesterol | integer | mmol/L |
| p30670 | Triglycerides | integer | mmol/L |
| p30740 | Apolipoprotein A | integer | g/L |
| p30750 | Apolipoprotein B | integer | g/L |
| p30780 | Lipoprotein(a) | integer | nmol/L |
| p30800 | C-reactive protein | integer | mg/L |
| p30810 | Cystatin C | integer | mg/L |
| p30830 | Gamma glutamyltransferase (GGT) | integer | U/L |
| p30850 | Alanine aminotransferase (ALT) | integer | U/L |
| p30870 | Aspartate aminotransferase (AST) | integer | U/L |
| p30880 | Bilirubin | integer | umol/L |
| p30900 | Urea | integer | mmol/L |
| p30910 | Creatinine | integer | umol/L |
| p30920 | Urate | integer | umol/L |
| p30930 | Glucose | integer | mmol/L |
| p30950 | HbA1c | integer | mmol/mol |
| p30760 | Glycated haemoglobin (HbA1c) | integer | mmol/mol |

### Urine
| Field | Name | Type | Description |
|-------|------|------|-------------|
| p30510 | Urine sodium | integer | mmol/L |
| p30520 | Urine potassium | integer | mmol/L |
| p30530 | Urine creatinine | integer | umol/L |
| p30540 | Urine albumin | integer | mg/L |
| p30550 | Urine albumin:creatinine ratio | integer | mg/mmol |

## Disease Diagnoses (ICD-10)

| Field | Name | Type | Description |
|-------|------|------|-------------|
| p131286 | Diabetes diagnosed by doctor | integer | 1=Yes, 0=No |
| p131287 | Type 1 diabetes | integer | |
| p131288 | Type 2 diabetes | integer | |
| p131350 | Ischaemic heart disease | integer | 1=Yes, 0=No |
| p131351 | Heart attack/myocardial infarction | integer | |
| p131352 | Stroke | integer | |
| p131353 | Angina | integer | |
| p131354 | Heart failure | integer | |
| p131355 | Atrial fibrillation | integer | |
| p131359 | Peripheral arterial disease | integer | |
| p131360 | Hypertension | integer | |
| p131362 | Hypercholesterolaemia | integer | |
| p131478 | Chronic obstructive pulmonary disease | integer | |
| p131479 | Asthma | integer | |
| p131480 | Depression | integer | |
| p131481 | Anxiety/panic disorders | integer | |
| p131497 | Chronic kidney disease | integer | |
| p131498 | Liver disease | integer | |
| p131500 | Cancer (any) | integer | |

## Biomarkers (Olink)

| Field | Name | Type | Description |
|-------|------|------|-------------|
| p30801 | Olink GTX panel 1 proteins | array | |
| p30802 | Olink GTX panel 2 proteins | array | |
| p30803 | Olink GTX panel 3 proteins | array | |
| p30804 | Olink CVD panel proteins | array | |
| p30805 | Olink inflammation panel | array | |

## Lifestyle

| Field | Name | Type | Description |
|-------|------|------|-------------|
| p20116 | Current tobacco smoking | integer | 1=Never, 2=Previous, 3=Current |
| p20117 | Smoking pack years | integer | |
| p20160 | Alcohol drinker status | integer | 1=Never, 2=Previous, 3=Current |
| p20162 | Alcohol intake frequency | integer | |
| p20163 | Units of alcohol per week | integer | |
| p20164 | Former alcohol drinker | integer | |
| p20165 | Never drink alcohol | integer | |
| p20480 | Physical activity (IPAQ) | integer | |
| p20481 | Walk pace | integer | 1=Slow, 2=Average, 3=Brisk, 4=Steady |

## Diet

| Field | Name | Type | Description |
|-------|------|------|-------------|
| p20091 | Coffee intake | integer | cups/day |
| p20092 | Tea intake | integer | cups/day |
| p20086 | Salt added to food | integer | 1=Never, 2=Sometimes, 3=Usually |
| p20087 | Water intake | integer | glasses/day |

## Mental Health

| Field | Name | Type | Description |
|-------|------|------|-------------|
| p20489 | Ever depressed for 2+ weeks | integer | 1=Yes, 0=No |
| p20490 | Ever mania/hypomania | integer | |
| p20435 | Generalised anxiety disorder | integer | |
| p20433 | Neuroticism score | integer | |

## Cognitive

| Field | Name | Type | Description |
|-------|------|------|-------------|
| p20016 | Reaction time | integer | ms |
| p20018 | Numeric memory | integer | |
| p20019 | Prospective memory | integer | 1=Yes, 0=No |
| p20023 | Symbol digit substitution | integer | |

## Genetics

| Field | Name | Type | Description |
|-------|------|------|-------------|
| p22001 | Genetic sex | integer | 0=XX, 1=XY |
| p22009 | Polygenic score available | integer | |
| p22006 | Kinship to other participants | integer | |

## Array Fields

For array fields (e.g., `p21003` - age at assessment), use index notation:
- `p21003_i0` = first occurrence
- `p21003_i1` = second occurrence
- `p21003_i2` = third occurrence

## Field Search Keywords

Common keywords for `query_field_dict`:
- `olink`, `proteomics`
- `blood pressure`, `hypertension`
- `cholesterol`, `lipid`, `HDL`, `LDL`
- `diabetes`, `glucose`, `HbA1c`
- `cardiovascular`, `CVD`, `heart`
- `kidney`, `liver`, `liver function`
- `inflammation`, `CRP`
- `BMI`, `obesity`, `anthropometry`
- `smoking`, `alcohol`
- `depression`, `mental health`
- `cognitive`, `memory`
- `genetic`, `polygenic`
- `cancer`, `tumour`
- `respiratory`, `asthma`, `COPD`
