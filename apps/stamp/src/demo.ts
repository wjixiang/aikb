import { generateStamp, generateOfficialStamp, generateStampAsPng, saveSvg, StampFontFamily } from './index';

// 生成 SVG 字符串
const svg = generateOfficialStamp('株洲市中心医院', '结直肠肛门外一区', {
    size: 380,
    borderWidth: 7,
    showInnerCircle: false,
    fontFamily: StampFontFamily.FangSong,
    // centerTextStretch: 1.5
});

saveSvg(svg, './stamp.svg')