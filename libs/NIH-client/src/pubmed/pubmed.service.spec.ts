import { Test, TestingModule } from '@nestjs/testing';
import { PubmedService } from './pubmed.service';
import * as cheerio from 'cheerio';

describe('PubmedService', () => {
  let service: PubmedService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PubmedService],
    }).compile();

    service = module.get<PubmedService>(PubmedService);
  });

  it.skip('should be defined', async () => {
    // expect(service).toBeDefined();
    await service.searchByPattern({
      term: '(hypertension[Title]) AND (food[Text Word])',
      sort: '',
      filter: [],
      page: null
    })
  });

  it('should build search params correctly', () => {
    const testPattern = {
      term: '(hypertension[Title]) AND (food[Text Word])',
      sort: '',
      filter: [],
      page: null
    }

    const result = service.buildUrl(testPattern)
    expect(result).toBe('?term=%28hypertension%5BTitle%5D%29+AND+%28food%5BText+Word%5D%29')
  })

  it('should get articles', async () => {
    const $ = cheerio.load(testPubmedWebStr)
    const articles = service.getArticleProfileList($)
    console.log(articles)

    expect(articles).toBeDefined()
    expect(articles.length).toBeGreaterThan(0)
    expect(articles[0]).toHaveProperty('pmid')
    expect(articles[0]).toHaveProperty('title')
    expect(articles[0]).toHaveProperty('authors')
    expect(articles[0]).toHaveProperty('journalCitation')
    expect(articles[0]).toHaveProperty('snippet')

    // Verify first article data
    expect(articles[0].pmid).toBe('35910428')
    expect(articles[0].title).toContain('Food')
    expect(articles[0].title).toContain('Hypertension')
    expect(articles[0].authors).toContain('Rusmevichientong')
    expect(articles[0].journalCitation).toContain('Int J Public Health')
    expect(articles[0].snippet).toContain('food choices')
  })
});

const testPubmedWebStr = `<html lang="en"><head itemscope="" itemtype="http://schema.org/WebPage" prefix="og: http://ogp.me/ns#"><meta name="emotion-insertion-point" content="">
    <meta charset="UTF-8">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">

    <!-- Mobile properties -->
    <meta name="HandheldFriendly" content="True">
    <meta name="MobileOptimized" content="320">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">

  
  
  <link rel="preconnect" href="https://cdn.ncbi.nlm.nih.gov">
  <link rel="preconnect" href="https://www.ncbi.nlm.nih.gov">
  <link rel="preconnect" href="https://www.google-analytics.com">

  
  
    <link rel="stylesheet" href="https://cdn.ncbi.nlm.nih.gov/pubmed/6aa07a65-6caa-4bbc-acaa-48623b669c29/CACHE/css/output.8af684516550.css" type="text/css">
  

  <link rel="stylesheet" href="https://cdn.ncbi.nlm.nih.gov/pubmed/6aa07a65-6caa-4bbc-acaa-48623b669c29/CACHE/css/output.452c70ce66f7.css" type="text/css">

  
    
  

  
    <link rel="stylesheet" href="https://cdn.ncbi.nlm.nih.gov/pubmed/6aa07a65-6caa-4bbc-acaa-48623b669c29/CACHE/css/output.bf1e691a9201.css" type="text/css">
  

  

  <link rel="stylesheet" href="https://cdn.ncbi.nlm.nih.gov/pubmed/6aa07a65-6caa-4bbc-acaa-48623b669c29/CACHE/css/output.6e01beaf2b72.css" type="text/css">

  

  <link rel="stylesheet" href="https://cdn.ncbi.nlm.nih.gov/pubmed/6aa07a65-6caa-4bbc-acaa-48623b669c29/CACHE/css/output.23b27e3d0764.css" type="text/css">


    <title>(hypertension[Title]) AND (food[Text Word]) - Search Results - PubMed</title>

  
  
  <!-- Favicons -->
  <link rel="shortcut icon" type="image/ico" href="https://cdn.ncbi.nlm.nih.gov/coreutils/nwds/img/favicons/favicon.ico">
  <link rel="icon" type="image/png" href="https://cdn.ncbi.nlm.nih.gov/coreutils/nwds/img/favicons/favicon.png">

  <!-- 192x192, as recommended for Android
  http://updates.html5rocks.com/2014/11/Support-for-theme-color-in-Chrome-39-for-Android
  -->
  <link rel="icon" type="image/png" sizes="192x192" href="https://cdn.ncbi.nlm.nih.gov/coreutils/nwds/img/favicons/favicon-192.png">

  <!-- 57x57 (precomposed) for iPhone 3GS, pre-2011 iPod Touch and older Android devices -->
  <link rel="apple-touch-icon-precomposed" href="https://cdn.ncbi.nlm.nih.gov/coreutils/nwds/img/favicons/favicon-57.png">
  <!-- 72x72 (precomposed) for 1st generation iPad, iPad 2 and iPad mini -->
  <link rel="apple-touch-icon-precomposed" sizes="72x72" href="https://cdn.ncbi.nlm.nih.gov/coreutils/nwds/img/favicons/favicon-72.png">
  <!-- 114x114 (precomposed) for iPhone 4, 4S, 5 and post-2011 iPod Touch -->
  <link rel="apple-touch-icon-precomposed" sizes="114x114" href="https://cdn.ncbi.nlm.nih.gov/coreutils/nwds/img/favicons/favicon-114.png">
  <!-- 144x144 (precomposed) for iPad 3rd and 4th generation -->
  <link rel="apple-touch-icon-precomposed" sizes="144x144" href="https://cdn.ncbi.nlm.nih.gov/coreutils/nwds/img/favicons/favicon-144.png">


  <!-- For Pinger + Google Optimize integration (NS-820) -->
  <meta name="ncbi_sg_optimize_id" content="">

  <!-- Mobile browser address bar color -->
  <meta name="theme-color" content="#20558a">

  <!-- Preserve the Referrer when going from HTTPS to HTTP -->
  <meta name="referrer" content="origin-when-cross-origin">

  <meta name="ncbi_pinger_gtm_track" content="true">
<!-- Logging params: Pinger defaults -->

  
    <meta name="ncbi_app" content="pubmed">
  

  
    <meta name="ncbi_db" content="pubmed">
  

  
    <meta name="ncbi_phid" content="8A2E000120C4810500003E7CD70FE9A2.1.m_3">
  

  
    <meta name="ncbi_pinger_stat_url" content="https://pubmed.ncbi.nlm.nih.gov/stat">
  

  
    <meta name="log_category" content="literature">
  

  
    <meta name="ncbi_cost_center" content="pubmed">
  



  <!-- Logging params: Pinger custom -->
  
    <meta name="log_op" content="search">
  
    <meta name="log_query" content="(hypertension[Title]) AND (food[Text Word])">
  
    <meta name="ncbi_pdid" content="searchresult">
  
    <meta name="ncbi_pageno" content="2">
  
    <meta name="log_resultcount" content="1827">
  
    <meta name="log_userterm" content="(hypertension[Title]) AND (food[Text Word])">
  
    <meta name="log_processedquery" content="&quot;hypertension&quot;[Title] AND &quot;food&quot;[Text Word]">
  
    <meta name="log_filtersactive" content="False">
  
    <meta name="log_filters" content="">
  
    <meta name="ncbi_log_query" content="(hypertension[Title]) AND (food[Text Word])">
  
    <meta name="log_proximity_search_active" content="False">
  
    <meta name="log_format" content="summary">
  
    <meta name="log_sortorder" content="relevance">
  
    <meta name="log_pagesize" content="10">
  
    <meta name="log_displayeduids" content="35910428,26449129,35417736,39975789,40405724,31023830,33541612,28818842,39067698,23627503">
  
    <meta name="ncbi_search_id" content="SAUuwOlTo2mdAQLDve4B3Q:d7541b75aa9777484f585e144ed71675">
  
    <meta name="ncbi_adj_nav_search_id" content="12CuymswsAxsuKpK9LnLBQ:d7541b75aa9777484f585e144ed71675">
  



  <!-- Social meta tags for unfurling urls -->
  
<meta name="description" content="(hypertension[Title]) AND (food[Text Word]) - Search Results - PubMed"><meta name="robots" content="noindex,follow,noarchive"><meta property="og:title" content="(hypertension[Title]) AND (food[Text Word]) - Search Results - PubMed"><meta property="og:url" content="https://pubmed.ncbi.nlm.nih.gov/?term=(hypertension%5BTitle%5D)%20AND%20(food%5BText%20Word%5D)%20&amp;page=2"><meta property="og:description" content="(hypertension[Title]) AND (food[Text Word]) - Search Results - PubMed"><meta property="og:image" content="https://cdn.ncbi.nlm.nih.gov/pubmed/persistent/pubmed-meta-image-v2.jpg"><meta property="og:image:secure_url" content="https://cdn.ncbi.nlm.nih.gov/pubmed/persistent/pubmed-meta-image-v2.jpg"><meta property="og:type" content="website"><meta property="og:site_name" content="PubMed"><meta name="twitter:domain" content="pubmed.ncbi.nlm.nih.gov"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="(hypertension[Title]) AND (food[Text Word]) - Search Results - PubMed"><meta name="twitter:url" content="https://pubmed.ncbi.nlm.nih.gov/?term=(hypertension%5BTitle%5D)%20AND%20(food%5BText%20Word%5D)%20&amp;page=2"><meta name="twitter:description" content="(hypertension[Title]) AND (food[Text Word]) - Search Results - PubMed"><meta name="twitter:image" content="https://cdn.ncbi.nlm.nih.gov/pubmed/persistent/pubmed-meta-image-v2.jpg">


  <!-- OpenSearch XML -->
  <link rel="search" type="application/opensearchdescription+xml" href="https://cdn.ncbi.nlm.nih.gov/pubmed/persistent/opensearch.xml" title="PubMed search">

  <!-- Disables severely broken elements when no JS -->
  <noscript>
    <link rel="stylesheet" type="text/css" href="https://cdn.ncbi.nlm.nih.gov/pubmed/6aa07a65-6caa-4bbc-acaa-48623b669c29/core/no-script.css">
  </noscript>


  
    <link rel="canonical" href="https://pubmed.ncbi.nlm.nih.gov/?term=(hypertension%5BTitle%5D)%20AND%20(food%5BText%20Word%5D)%20&amp;page=2">
  


<meta name="ncbi_nwds_ver" content="1.2.5"><meta name="ncbi_nwds" content="yes"><script type="text/javascript" async="" src="https://www.googletagmanager.com/gtag/js?id=G-DP2X732JSX&amp;l=pingerDataLayer&amp;cx=c&amp;gtm=4e6171"></script><script async="" src="https://www.googletagmanager.com/gtm.js?id=GTM-PC9B6M3&amp;l=pingerDataLayer" id="pingerInjectedGTM"></script><style type="text/css">@font-face {
  font-family: "xm-iconfont";
  src: url('//at.alicdn.com/t/font_792691_ptvyboo0bno.eot?t=1574048839056');
  /* IE9 */
  src: url('//at.alicdn.com/t/font_792691_ptvyboo0bno.eot?t=1574048839056#iefix') format('embedded-opentype'), /* IE6-IE8 */ url('data:application/x-font-woff2;charset=utf-8;base64,d09GMgABAAAAAAksAAsAAAAAEYAAAAjeAAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHEIGVgCEUgqTXI8lATYCJAM0CxwABCAFhG0HgTwbZQ4jEbaCkVIj+4sD3sS6BFAp9ka91ulVG4leTC/+h+3V+zyRYCTyREKkcZ+D5/u137lPdveLGJBMunoiNPOQPBMq0/FQtEKIkMRDZng69d+hOiQumAr7bJdBOEzMTU77s78mhbI58aCg7ebCs4LBTgCk+cD/4ZqWUHebipp7al3tyKOjwCV/hVyw9PdzaktxI7IMQs26/1N8gV4DI0bVut3UhCaflGGgwM3oTXg1IfRMbCsmrEnriJVeYM2eXHII4KdMMzL4OoACHgZBCTasITcReDUBE8kWPLMTCGoQaDV+eKpUPQI49r8vP6BTPIDCaiBSml3oOQX0voNPebv/u2P0AUfP1w0s5EADzYBZsNdByylo2eVq/NtRdgFpovQR5x2CIwmIZeik6/u0T/m/A7RJP00sCmmyksj/kwc+LC5BFBqDEMDDjwPiANDB9MpJTXwHmsO3YyBwWDA4OFwwJLRcRgAOBUYMDg0mHRwGTAYozsV0AgWYruDwwExDHfzwKWf4OurQ9jzQDtoF+wpistfBfluQ5bQiiJa4ZQoKhShLiMayBbyg05AIkYBoIBJEEApQy/FwYv4HchADIUBXl61dW6mpwIgyp7p8PrHddieSjhY9oqTxyPB/FGNYDklpfYh8VtaoqSgb0bKoGB17CuVUp9Ll2nS2UpNGMSw9hyirA7C6+QLyByIQS0sSSmxvArC5odZmYZMxZSiBR5OkQl0uiufxMH5eL8t3u0d4XKyuq6EMdcpNe2+oXA8p9yPa+4T1PM7+A54tc7tpl2vcAHAftnhZj2chy1CyaCRFsyMqQ5nkNnskEt2yxxZinPsOZjFm4+XWvKqLkfCGS1k4MNP82isxSMf7ZsGYvQVCNAeSSVtzWCxRdXGxyZlA2CvCEevuO7y9M2z2NWH8icydzq/qAJSp1lGvDWFp6Nw3xChJowPD+76nU+upQk6Kw9jI0Rgym9Ct8VlxMI3CSIaDCZja5tDYt0/EYra4tn0Kp3v8Rdezk8svcy1mKhoSvNcZz3LKlUe777Gmval0s7bzAc0k13LGk896V9DuvNn34N0ebKgItkQgOomuJtgQPChNI4cwa7CEWCvfk5QjJFlem6i3SfVShWi5LTFRG+JwdCNpSqbpRFwrtb1TbcRkJi/AbJJQOmfCdnswLNGVM7qqSRO1zO0Q0j5Vr3cYQ07HB0MX6KoIZhx+D9Djs2C5bXtVwvbgJHtSCIL7hjFJme4sZDdS5IlJdKUO1Qt8opn0trBafz3AX933kmCRgyMEWGZjMAkRKhwmIHJGR4ruwFCdWKYzrap2R/mvd2UKajzRAZu88pGAD90Y+02kTFCKrBSXwGGJ3wRcPCdIppTxSmHOfESRwIli0S5J/8AYDCxTGh4XZua4xvfvGx320rDK2qA8g5FlS7pWNLx71+BwgA/KZ5I0aeKmNeCNoNPl8qNHu8uHHzqaKc86fHi4vPuRI4ny+I/vjxw+clh4HXVCFvVnVFx07EHZwVhSRliTTMWSEi0h6YuS6DxCRmiin0B3L4ry6cvR0ijYexFdBL3wGQM0YOrUAZCBkLOBBtQ+xdk7omfgUv+u++admyUeXduyxLM+r/+49rPfhgEZor6GymToNYksNsZyC7ntwAH0928UpgMpxpF0ydNlsMMBw7QsxTCmu0Hf3F+/+vb99Yumhb+e9R0LBNm+4O+hu7lQ5bGjI9j5G88qQ5SLFyuEC7cwd25xoYo2j4eA4bhpM7TZhPtmc+uhVEVSMYXLWh0bfjI8dvUpvDUocPZmU4kwwOfc83wB5wPehrpD3waApbwW+fgRrZXcxw+mB/3woZT+8JFMYwRMIy2k/18qhqcKpjYeYSnIACaUoRDu0e3kQFh98R5fiI8oJqwwGZSJDSbehLzZs7zIeWTQ4UGOIs2c4j2/Q/tn7n7j9juO33On6WhURCT/wO6Y3QdmWFY0Ef6JUeGRggO7ZbtaZlh5RYKWXbLPBLc3l/5h4A0mu3ZXTZ+u6t6VHMAzZhxak50T+24NnRuaOmehRkXlqVR5lIpuwezUUDUdCuJysv8Z/0/8uNE1s7jIJIubFWnI/x7g4nAZx79yYpFoAOU3a9iwT1O/GxUxPY0ljVPv9EukI3qNrl/So2YfzasqHCroNjS0+w0tlPlsYfC6v/01ixquizJH1Kd/VK+OS3iS3rTJWmqsMPdU3B3oFyC9RSumWE/0gG36IjTysfH51IJ/5oOgNYu6p4yb5Fdufhr/Kjtu0oSyYP/WJQrz35aNFnMhtFcwb55NlNnH8Wdu1b+XZA9zqlZrhdPo/V3uBhiUlQ66h0LhbAmFYIncdFOpVMh6Fl7peqy5Z2ZdQBITO2x1Asj1dRFjIBMC3hbuUh8Ooc4W03EjAdo8UL/t0oUfyU8630bmMcw/vqDNAsC9BQD4OqCgH+ljy0UhJB8AAJA+8EmArxk5gnRLik90AElf8rBm+IMvBTWnucb3+0o0ARk+r0ZBv8sU01nnSmP45/H8Dp8C8X+iE9e+ZvXymK/sQJ5/DuqhYKebPnKmPqLYuDcIMWS2/Rjxp2s8Do821LVn6A/xMK1RKvBLK5gyDsZ5uQ6bYusmx2yqLFe4lECHDPcFhojmckuAbnCI6Cn308RI6AAJdtCICQLQyBHKhSgX5YowN6BBPIEB8VxuSfNncpAuutzPnCSiDHDEo+DsKQBPoJi4MpRktepIs2zjO5h84IEMM3ffECKSZU1ZHxfewEI4h494MuuUNNOBjuw18QKHAzEXaAcylS3m3baq9MpnKenYmfEUgCdbXTHEtTVKsvruNGv9/DuYfOAhcuKu9TeEiA9nNJTUDOUbbVkn3sv2eDJrEnVrpvcHOjJeqRsOcpYYLuxoBzKVtCOm3ZaKbtJcurw+e/zN6c7Pd6r4gqUo0WLEiiOueOITvwQkKCEJM9nO3F60y5HkqLhdqUyXZtK3lqwReQ+G40O92UhOt0x/KmKM+u7LTPMzoEBOCYtiUPfSjODiuFXjSDm2idzAoc4Tj9bs2eJYDOU7HQA=') format('woff2'), url('//at.alicdn.com/t/font_792691_ptvyboo0bno.woff?t=1574048839056') format('woff'), url('//at.alicdn.com/t/font_792691_ptvyboo0bno.ttf?t=1574048839056') format('truetype'), /* chrome, firefox, opera, Safari, Android, iOS 4.2+ */ url('//at.alicdn.com/t/font_792691_ptvyboo0bno.svg?t=1574048839056#iconfont') format('svg');
  /* iOS 4.1- */
}
.xm-iconfont {
  font-family: "xm-iconfont" !important;
  font-size: 16px;
  font-style: normal;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}
.xm-icon-quanxuan:before {
  content: "\e62c";
}
.xm-icon-caidan:before {
  content: "\e610";
}
.xm-icon-fanxuan:before {
  content: "\e837";
}
.xm-icon-pifu:before {
  content: "\e668";
}
.xm-icon-qingkong:before {
  content: "\e63e";
}
.xm-icon-sousuo:before {
  content: "\e600";
}
.xm-icon-danx:before {
  content: "\e62b";
}
.xm-icon-duox:before {
  content: "\e613";
}
.xm-icon-close:before {
  content: "\e601";
}
.xm-icon-expand:before {
  content: "\e641";
}
.xm-icon-banxuan:before {
  content: "\e60d";
}
</style><style type="text/css">@-webkit-keyframes xm-upbit {
  from {
    -webkit-transform: translate3d(0, 30px, 0);
    opacity: 0.3;
  }
  to {
    -webkit-transform: translate3d(0, 0, 0);
    opacity: 1;
  }
}
@keyframes xm-upbit {
  from {
    transform: translate3d(0, 30px, 0);
    opacity: 0.3;
  }
  to {
    transform: translate3d(0, 0, 0);
    opacity: 1;
  }
}
@-webkit-keyframes loader {
  0% {
    -webkit-transform: rotate(0deg);
    transform: rotate(0deg);
  }
  100% {
    -webkit-transform: rotate(360deg);
    transform: rotate(360deg);
  }
}
@keyframes loader {
  0% {
    -webkit-transform: rotate(0deg);
    transform: rotate(0deg);
  }
  100% {
    -webkit-transform: rotate(360deg);
    transform: rotate(360deg);
  }
}
xm-select {
  background-color: #FFF;
  position: relative;
  border: 1px solid #E6E6E6;
  border-radius: 2px;
  display: block;
  width: 100%;
  cursor: pointer;
  outline: none;
}
xm-select * {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
  font-size: 14px;
  font-weight: 400;
  text-overflow: ellipsis;
  user-select: none;
  -ms-user-select: none;
  -moz-user-select: none;
  -webkit-user-select: none;
}
xm-select:hover,
xm-select:focus {
  border-color: #C0C4CC;
}
xm-select > .xm-tips {
  color: #999999;
  padding: 0 10px;
  position: absolute;
  display: flex;
  height: 100%;
  align-items: center;
}
xm-select > .xm-icon {
  display: inline-block;
  overflow: hidden;
  position: absolute;
  width: 0;
  height: 0;
  right: 10px;
  top: 50%;
  margin-top: -3px;
  cursor: pointer;
  border: 6px dashed transparent;
  border-top-color: #C2C2C2;
  border-top-style: solid;
  transition: all 0.3s;
  -webkit-transition: all 0.3s;
}
xm-select > .xm-icon-expand {
  margin-top: -9px;
  transform: rotate(180deg);
}
xm-select > .xm-label.single-row {
  position: absolute;
  top: 0;
  bottom: 0px;
  left: 0px;
  right: 30px;
  overflow: auto hidden;
}
xm-select > .xm-label.single-row .scroll {
  overflow-y: hidden;
}
xm-select > .xm-label.single-row .label-content {
  flex-wrap: nowrap;
  white-space: nowrap;
}
xm-select > .xm-label.auto-row .label-content {
  flex-wrap: wrap;
  padding-right: 30px !important;
}
xm-select > .xm-label.auto-row .xm-label-block > span {
  white-space: unset;
  height: 100%;
}
xm-select > .xm-label .scroll .label-content {
  display: flex;
  padding: 3px 10px;
}
xm-select > .xm-label .xm-label-block {
  display: flex;
  position: relative;
  padding: 0px 5px;
  margin: 2px 5px 2px 0;
  border-radius: 3px;
  align-items: baseline;
  color: #FFF;
}
xm-select > .xm-label .xm-label-block > span {
  display: flex;
  color: #FFF;
  white-space: nowrap;
}
xm-select > .xm-label .xm-label-block > i {
  color: #FFF;
  margin-left: 8px;
  font-size: 12px;
  cursor: pointer;
  display: flex;
}
xm-select > .xm-label .xm-label-block.disabled {
  background-color: #C2C2C2 !important;
  cursor: no-drop !important;
}
xm-select > .xm-label .xm-label-block.disabled > i {
  cursor: no-drop !important;
}
xm-select > .xm-body {
  position: absolute;
  left: 0;
  top: 42px;
  padding: 5px 0;
  z-index: 999;
  width: 100%;
  min-width: fit-content;
  border: 1px solid #E6E6E6;
  background-color: #fff;
  border-radius: 2px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.12);
  animation-name: xm-upbit;
  animation-duration: 0.3s;
  animation-fill-mode: both;
}
xm-select > .xm-body .scroll-body {
  overflow-x: hidden;
  overflow-y: auto;
}
xm-select > .xm-body .scroll-body::-webkit-scrollbar {
  width: 8px;
}
xm-select > .xm-body .scroll-body::-webkit-scrollbar-track {
  -webkit-border-radius: 2em;
  -moz-border-radius: 2em;
  -ms-border-radius: 2em;
  border-radius: 2em;
  background-color: #FFF;
}
xm-select > .xm-body .scroll-body::-webkit-scrollbar-thumb {
  -webkit-border-radius: 2em;
  -moz-border-radius: 2em;
  -ms-border-radius: 2em;
  border-radius: 2em;
  background-color: #C2C2C2;
}
xm-select > .xm-body.up {
  top: auto;
  bottom: 42px;
}
xm-select > .xm-body.relative {
  position: relative;
  display: block !important;
  top: 0;
  box-shadow: none;
  border: none;
  animation-name: none;
  animation-duration: 0;
  min-width: 100%;
}
xm-select > .xm-body .xm-group {
  cursor: default;
}
xm-select > .xm-body .xm-group-item {
  display: inline-block;
  cursor: pointer;
  padding: 0 10px;
  color: #999;
  font-size: 12px;
}
xm-select > .xm-body .xm-option {
  display: flex;
  align-items: center;
  position: relative;
  padding: 0 10px;
  cursor: pointer;
}
xm-select > .xm-body .xm-option-icon {
  color: transparent;
  display: flex;
  border: 1px solid #E6E6E6;
  border-radius: 3px;
  justify-content: center;
  align-items: center;
}
xm-select > .xm-body .xm-option-icon.xm-custom-icon {
  color: unset;
  border: unset;
}
xm-select > .xm-body .xm-option-icon-hidden {
  margin-right: -10px;
}
xm-select > .xm-body .xm-option-icon.xm-icon-danx {
  border-radius: 100%;
}
xm-select > .xm-body .xm-option-content {
  display: flex;
  position: relative;
  padding-left: 15px;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  ;
  width: calc(100% - 20px);
}
xm-select > .xm-body .xm-option.hide-icon .xm-option-content {
  padding-left: 0;
}
xm-select > .xm-body .xm-option.selected.hide-icon .xm-option-content {
  color: #FFF !important;
}
xm-select > .xm-body .xm-option .loader {
  width: 0.8em;
  height: 0.8em;
  margin-right: 6px;
  color: #C2C2C2;
}
xm-select > .xm-body .xm-select-empty {
  text-align: center;
  color: #999;
}
xm-select > .xm-body .disabled {
  cursor: no-drop;
}
xm-select > .xm-body .disabled:hover {
  background-color: #FFF;
}
xm-select > .xm-body .disabled .xm-option-icon {
  border-color: #C2C2C2 !important;
}
xm-select > .xm-body .disabled .xm-option-content {
  color: #C2C2C2 !important;
}
xm-select > .xm-body .disabled.selected > .xm-option-icon {
  color: #C2C2C2 !important;
}
xm-select > .xm-body .xm-search {
  background-color: #FFF !important;
  position: relative;
  padding: 0 10px;
  margin-bottom: 5px;
  cursor: pointer;
}
xm-select > .xm-body .xm-search > i {
  position: absolute;
  color: ;
}
xm-select > .xm-body .xm-search-input {
  border: none;
  border-bottom: 1px solid #E6E6E6;
  padding-left: 27px;
  cursor: text;
}
xm-select > .xm-body .xm-paging {
  padding: 0 10px;
  display: flex;
  margin-top: 5px;
}
xm-select > .xm-body .xm-paging > span:first-child {
  border-radius: 2px 0 0 2px;
}
xm-select > .xm-body .xm-paging > span:last-child {
  border-radius: 0 2px 2px 0;
}
xm-select > .xm-body .xm-paging > span {
  display: flex;
  flex: auto;
  justify-content: center;
  vertical-align: middle;
  margin: 0 -1px 0 0;
  background-color: #fff;
  color: #333;
  font-size: 12px;
  border: 1px solid #e2e2e2;
  flex-wrap: nowrap;
  width: 100%;
  overflow: hidden;
  min-width: 50px;
}
xm-select > .xm-body .xm-toolbar {
  padding: 0 10px;
  display: flex;
  margin: -3px 0;
  cursor: default;
}
xm-select > .xm-body .xm-toolbar .toolbar-tag {
  cursor: pointer;
  display: flex;
  margin-right: 20px;
  color: ;
  align-items: baseline;
}
xm-select > .xm-body .xm-toolbar .toolbar-tag:hover {
  opacity: 0.8;
}
xm-select > .xm-body .xm-toolbar .toolbar-tag:active {
  opacity: 1;
}
xm-select > .xm-body .xm-toolbar .toolbar-tag > i {
  margin-right: 2px;
  font-size: 14px;
}
xm-select > .xm-body .xm-toolbar .toolbar-tag:last-child {
  margin-right: 0;
}
xm-select > .xm-body .xm-body-custom {
  line-height: initial;
  cursor: default;
}
xm-select > .xm-body .xm-body-custom * {
  box-sizing: initial;
}
xm-select > .xm-body .xm-tree {
  position: relative;
}
xm-select > .xm-body .xm-tree-icon {
  display: inline-block;
  margin-right: 3px;
  cursor: pointer;
  border: 6px dashed transparent;
  border-left-color: #C2C2C2;
  border-left-style: solid;
  transition: all 0.3s;
  -webkit-transition: all 0.3s;
  z-index: 2;
  visibility: hidden;
}
xm-select > .xm-body .xm-tree-icon.expand {
  margin-top: 3px;
  margin-right: 5px;
  margin-left: -2px;
  transform: rotate(90deg);
}
xm-select > .xm-body .xm-tree-icon.xm-visible {
  visibility: visible;
}
xm-select > .xm-body .xm-tree .left-line {
  position: absolute;
  left: 13px;
  width: 0;
  z-index: 1;
  border-left: 1px dotted #c0c4cc !important;
}
xm-select > .xm-body .xm-tree .top-line {
  position: absolute;
  left: 13px;
  height: 0;
  z-index: 1;
  border-top: 1px dotted #c0c4cc !important;
}
xm-select > .xm-body .xm-tree .xm-tree-icon + .top-line {
  margin-left: 1px;
}
xm-select > .xm-body .scroll-body > .xm-tree > .xm-option > .top-line,
xm-select > .xm-body .scroll-body > .xm-option > .top-line {
  width: 0 !important;
}
xm-select > .xm-body .xm-cascader-box {
  position: absolute;
  left: 0;
  right: 0;
  top: 0;
  bottom: 0;
  padding: 5px 0;
  border: 1px solid #E6E6E6;
  background-color: #fff;
  border-radius: 2px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.12);
  margin: -1px;
}
xm-select > .xm-body .xm-cascader-box::before {
  content: ' ';
  position: absolute;
  width: 0;
  height: 0;
  border: 6px solid transparent;
  border-right-color: #E6E6E6;
  top: 10px;
  left: -12px;
}
xm-select > .xm-body .xm-cascader-box::after {
  content: ' ';
  position: absolute;
  width: 0;
  height: 0;
  border: 6px solid transparent;
  border-right-color: #fff;
  top: 10px;
  left: -11px;
}
xm-select > .xm-body .xm-cascader-scroll {
  height: 100%;
  overflow-x: hidden;
  overflow-y: auto;
}
xm-select > .xm-body.cascader {
  width: unset;
  min-width: unset;
}
xm-select > .xm-body.cascader .xm-option-content {
  padding-left: 8px;
}
xm-select > .xm-body.cascader .disabled .xm-right-arrow {
  color: #C2C2C2 !important;
}
xm-select > .xm-body.cascader .hide-icon.disabled .xm-right-arrow {
  color: #999 !important;
}
xm-select .xm-input {
  cursor: pointer;
  border-radius: 2px;
  border-width: 1px;
  border-style: solid;
  border-color: #E6E6E6;
  display: block;
  width: 100%;
  box-sizing: border-box;
  background-color: #FFF;
  line-height: 1.3;
  padding-left: 10px;
  outline: 0;
  user-select: text;
  -ms-user-select: text;
  -moz-user-select: text;
  -webkit-user-select: text;
}
xm-select .dis {
  display: none;
}
xm-select .loading {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(255, 255, 255, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
}
xm-select .loader {
  border: 0.2em dotted currentcolor;
  border-radius: 50%;
  -webkit-animation: 1s loader linear infinite;
  animation: 1s loader linear infinite;
  display: inline-block;
  width: 1em;
  height: 1em;
  color: inherit;
  vertical-align: middle;
  pointer-events: none;
}
xm-select .xm-select-default {
  position: absolute;
  width: 100%;
  height: 100%;
  border: none;
  visibility: hidden;
}
xm-select .xm-select-disabled {
  position: absolute;
  left: 0;
  right: 0;
  top: 0;
  bottom: 0;
  cursor: no-drop;
  z-index: 2;
  opacity: 0.3;
  background-color: #FFF;
}
xm-select .item--divided {
  border-top: 1px solid #ebeef5;
  width: calc(100% - 20px);
  cursor: initial;
}
xm-select .xm-right-arrow {
  position: absolute;
  color: ;
  right: 5px;
  top: -1px;
  font-weight: 700;
  transform: scale(0.6, 1);
}
xm-select .xm-right-arrow::after {
  content: '>';
}
xm-select[size='large'] {
  min-height: 40px;
  line-height: 40px;
}
xm-select[size='large'] .xm-input {
  height: 40px;
}
xm-select[size='large'] .xm-label .scroll .label-content {
  line-height: 34px;
}
xm-select[size='large'] .xm-label .xm-label-block {
  height: 30px;
  line-height: 30px;
}
xm-select[size='large'] .xm-body .xm-option .xm-option-icon {
  height: 20px;
  width: 20px;
  font-size: 20px;
}
xm-select[size='large'] .xm-paging > span {
  height: 34px;
  line-height: 34px;
}
xm-select[size='large'] .xm-tree .left-line {
  height: 100%;
  bottom: 20px;
}
xm-select[size='large'] .xm-tree .left-line-group {
  height: calc(100% - 40px);
}
xm-select[size='large'] .xm-tree .xm-tree-icon.xm-hidden + .top-line {
  top: 19px;
}
xm-select[size='large'] .item--divided {
  margin: 10px;
}
xm-select {
  min-height: 36px;
  line-height: 36px;
}
xm-select .xm-input {
  height: 36px;
}
xm-select .xm-label .scroll .label-content {
  line-height: 30px;
}
xm-select .xm-label .xm-label-block {
  height: 26px;
  line-height: 26px;
}
xm-select .xm-body .xm-option .xm-option-icon {
  height: 18px;
  width: 18px;
  font-size: 18px;
}
xm-select .xm-paging > span {
  height: 30px;
  line-height: 30px;
}
xm-select .xm-tree .left-line {
  height: 100%;
  bottom: 18px;
}
xm-select .xm-tree .left-line-group {
  height: calc(100% - 36px);
}
xm-select .xm-tree .xm-tree-icon.xm-hidden + .top-line {
  top: 17px;
}
xm-select .item--divided {
  margin: 9px;
}
xm-select[size='small'] {
  min-height: 32px;
  line-height: 32px;
}
xm-select[size='small'] .xm-input {
  height: 32px;
}
xm-select[size='small'] .xm-label .scroll .label-content {
  line-height: 26px;
}
xm-select[size='small'] .xm-label .xm-label-block {
  height: 22px;
  line-height: 22px;
}
xm-select[size='small'] .xm-body .xm-option .xm-option-icon {
  height: 16px;
  width: 16px;
  font-size: 16px;
}
xm-select[size='small'] .xm-paging > span {
  height: 26px;
  line-height: 26px;
}
xm-select[size='small'] .xm-tree .left-line {
  height: 100%;
  bottom: 16px;
}
xm-select[size='small'] .xm-tree .left-line-group {
  height: calc(100% - 32px);
}
xm-select[size='small'] .xm-tree .xm-tree-icon.xm-hidden + .top-line {
  top: 15px;
}
xm-select[size='small'] .item--divided {
  margin: 8px;
}
xm-select[size='mini'] {
  min-height: 28px;
  line-height: 28px;
}
xm-select[size='mini'] .xm-input {
  height: 28px;
}
xm-select[size='mini'] .xm-label .scroll .label-content {
  line-height: 22px;
}
xm-select[size='mini'] .xm-label .xm-label-block {
  height: 18px;
  line-height: 18px;
}
xm-select[size='mini'] .xm-body .xm-option .xm-option-icon {
  height: 14px;
  width: 14px;
  font-size: 14px;
}
xm-select[size='mini'] .xm-paging > span {
  height: 22px;
  line-height: 22px;
}
xm-select[size='mini'] .xm-tree .left-line {
  height: 100%;
  bottom: 14px;
}
xm-select[size='mini'] .xm-tree .left-line-group {
  height: calc(100% - 28px);
}
xm-select[size='mini'] .xm-tree .xm-tree-icon.xm-hidden + .top-line {
  top: 13px;
}
xm-select[size='mini'] .item--divided {
  margin: 7px;
}
.layui-form-pane xm-select {
  margin: -1px -1px -1px 0;
}
</style><script src="https://dap.digitalgov.gov/web-vitals/dist/web-vitals.attribution.iife.js"></script><script type="text/javascript" src="https://www.googletagmanager.com/gtag/js?id=G-CSLL4ZEK4L"></script><script src="chrome-extension://kmmcnncdadfmbjkoloakclhfllocaeap/assets/inject-stop-propagation.js"></script><style>.ncbi-alerts {width: 100%;}.ncbi-alerts .ncbi-alert__shutdown-outer { position: relative; background-color: #f4e3db; border-left: 8px solid #d54309;  background-image: url("data:image/svg+xml,%3C%3Fxml version='1.0' encoding='UTF-8'%3F%3E%3Csvg xmlns='http://www.w3.org/2000/svg' width='126' height='126' viewBox='0 0 126 126'%3E%3Cpath fill='%231B1B1B' d='M117.18,31.592 C111.585,22.006 103.995,14.416 94.409,8.821 C84.821,3.226 74.354,0.429 63.001,0.429 C51.649,0.429 41.18,3.226 31.593,8.821 C22.006,14.415 14.416,22.005 8.821,31.592 C3.225,41.179 0.428,51.649 0.428,63 C0.428,74.351 3.226,84.82 8.82,94.408 C14.415,103.992 22.005,111.584 31.592,117.179 C41.179,122.774 51.648,125.571 63,125.571 C74.352,125.571 84.822,122.774 94.408,117.179 C103.994,111.585 111.584,103.994 117.179,94.408 C122.773,84.82 125.57,74.35 125.57,63 C125.57,51.649 122.773,41.178 117.18,31.592 Z M73.43,102.025 C73.43,102.786 73.184,103.423 72.696,103.939 C72.208,104.455 71.61,104.712 70.903,104.712 L55.26,104.712 C54.554,104.712 53.929,104.441 53.386,103.898 C52.843,103.355 52.572,102.73 52.572,102.025 L52.572,86.546 C52.572,85.84 52.843,85.215 53.386,84.672 C53.929,84.129 54.554,83.858 55.26,83.858 L70.903,83.858 C71.61,83.858 72.209,84.116 72.696,84.631 C73.184,85.149 73.43,85.785 73.43,86.546 L73.43,102.025 Z M73.266,73.999 C73.211,74.542 72.927,75.018 72.412,75.425 C71.895,75.832 71.258,76.035 70.498,76.035 L55.425,76.035 C54.664,76.035 54.012,75.832 53.469,75.425 C52.926,75.018 52.654,74.542 52.654,73.999 L51.269,23.404 C51.269,22.751 51.54,22.263 52.083,21.937 C52.627,21.503 53.279,21.285 54.039,21.285 L71.965,21.285 C72.726,21.285 73.377,21.502 73.92,21.937 C74.463,22.263 74.733,22.752 74.733,23.404 L73.266,73.999 Z'/%3E%3C/svg%3E%0A");}.ncbi-alerts .ncbi-alert__info-outer { position: relative; background-color: #e7f6f8; border-left: 8px solid #00bde3; background-image: url("data:image/svg+xml,%3C%3Fxml version='1.0' encoding='UTF-8'%3F%3E%3Csvg xmlns='http://www.w3.org/2000/svg' width='126' height='126' viewBox='0 0 126 126'%3E%3Cpath fill='%231B1B1B' d='M117.18,31.592 C111.585,22.006 103.995,14.416 94.409,8.821 C84.821,3.226 74.354,0.429 63.001,0.429 C51.649,0.429 41.179,3.226 31.593,8.821 C22.006,14.415 14.416,22.005 8.821,31.592 C3.225,41.179 0.428,51.649 0.428,63 C0.428,74.352 3.226,84.82 8.82,94.408 C14.415,103.993 22.005,111.584 31.592,117.179 C41.179,122.774 51.648,125.571 63,125.571 C74.352,125.571 84.822,122.774 94.408,117.179 C103.994,111.585 111.584,103.994 117.179,94.408 C122.773,84.821 125.57,74.351 125.57,63 C125.57,51.648 122.773,41.178 117.18,31.592 Z M52.572,16.071 C52.572,15.31 52.816,14.686 53.305,14.197 C53.794,13.709 54.419,13.464 55.179,13.464 L70.823,13.464 C71.583,13.464 72.208,13.709 72.695,14.197 C73.183,14.686 73.429,15.31 73.429,16.071 L73.429,29.107 C73.429,29.867 73.183,30.492 72.695,30.98 C72.208,31.469 71.583,31.713 70.823,31.713 L55.179,31.713 C54.419,31.713 53.794,31.469 53.305,30.98 C52.816,30.492 52.572,29.867 52.572,29.107 L52.572,16.071 Z M83.857,102.107 C83.857,102.867 83.611,103.492 83.124,103.979 C82.637,104.468 82.012,104.712 81.25,104.712 L44.75,104.712 C43.989,104.712 43.365,104.468 42.876,103.979 C42.387,103.491 42.143,102.866 42.143,102.106 L42.143,89.07 C42.143,88.308 42.387,87.685 42.876,87.196 C43.365,86.708 43.99,86.463 44.75,86.463 L52.572,86.463 L52.572,60.392 L44.75,60.392 C43.989,60.392 43.365,60.148 42.876,59.659 C42.387,59.171 42.143,58.546 42.143,57.785 L42.143,44.75 C42.143,43.989 42.387,43.365 42.876,42.876 C43.365,42.387 43.99,42.143 44.75,42.143 L70.823,42.143 C71.583,42.143 72.208,42.387 72.695,42.876 C73.183,43.365 73.429,43.989 73.429,44.75 L73.429,86.464 L81.249,86.464 C82.01,86.464 82.635,86.709 83.123,87.197 C83.61,87.685 83.856,88.31 83.856,89.071 L83.856,102.107 L83.857,102.107 Z'/%3E%3C/svg%3E");}.ncbi-alerts div[class$="-outer"]{background-position: 28px 20px;  background-size: 32px 32px;  background-repeat: no-repeat;padding:20px 20px 20px 28px;}.ncbi-alerts div[class$="-inner"]{padding-left: 52px; padding-right: 52px;}@media (max-width: 639px){.ncbi-alerts div[class$="outer"]{background-position: 29px 20px;}.ncbi-alerts div[class$="-inner"]{padding-left: 0px; padding-right: 0px; padding-top: 0px;}}.ncbi-alerts button.close{cursor: pointer;position:absolute; top: 10px; right: 20px; width: 36px; height: 32px; border:0; background-color: transparent; background-image: url("data:image/svg+xml,%3Csvg version='1.2' xmlns='http://www.w3.org/2000/svg' xmlns:xlink='http://www.w3.org/1999/xlink' overflow='visible' preserveAspectRatio='none' viewBox='0 0 24 24' width='32' height='32'%3E%3Cg%3E%3Cpath xmlns:default='http://www.w3.org/2000/svg' id='window-close' d='M14.9,16.42c-0.13,0.13-0.33,0.14-0.47,0.01c0,0-0.01-0.01-0.01-0.01L12,14l-2.43,2.42 c-0.13,0.13-0.33,0.14-0.47,0.01c0,0-0.01-0.01-0.01-0.01L7.58,14.9c-0.13-0.13-0.14-0.33-0.01-0.47c0,0,0.01-0.01,0.01-0.01L10,12 L7.58,9.57C7.45,9.45,7.44,9.24,7.57,9.1c0,0,0.01-0.01,0.01-0.01L9.1,7.58c0.13-0.13,0.33-0.14,0.47-0.01c0,0,0.01,0.01,0.01,0.01 L12,10l2.43-2.43c0.13-0.13,0.33-0.14,0.47-0.01c0,0,0.01,0.01,0.01,0.01l1.51,1.53c0.13,0.13,0.14,0.33,0.01,0.47 c0,0-0.01,0.01-0.01,0.01L14,12l2.43,2.43c0.13,0.13,0.14,0.33,0.01,0.47c0,0-0.01,0.01-0.01,0.01L14.9,16.42L14.9,16.42z M20.84,4.49C20.53,4.17,20.1,3.99,19.66,4H4.34C3.42,4,2.67,4.75,2.67,5.67l0,0v12.66c0,0.92,0.75,1.67,1.67,1.67l0,0h15.32 c0.92,0,1.67-0.75,1.67-1.67l0,0V5.67C21.34,5.23,21.16,4.8,20.84,4.49z' style='fill: rgb(33, 33, 33);' vector-effect='non-scaling-stroke'/%3E%3C/g%3E%3C/svg%3E");background-size: 32px 32px; background-repeat:no-repeat;background-position:center center}.ncbi-alerts button.close:focus{ outline: 1px dotted #000000;}@media (max-width: 639px){.ncbi-alerts button.close{right: 0px;}}.ncbi-alerts p{margin-bottom: 0px; margin-top: 0px; font-size: 18px; line-height: 28px;}.ncbi-alerts .list-items > p{font-size: 0.94em; display: inline;}.ncbi-alerts .list-items > p a {font-weight: 700;}.ncbi-alerts .list-items > p:not(:last-child)::after{margin:0 8px;content:'|'}@media (min-width: 768px) and (max-width: 991px){.ncbi-alerts .list-items > p:nth-child(2)::after{content:'\a'!important;white-space: pre;}}@media(max-width: 767px){.ncbi-alerts .list-items > p{display:block;}.ncbi-alerts .list-items > p::after{content:''!important;}}.ncbi-alerts h3 {margin: 2px 0 1rem 0; padding: 0 52px; color: #000; font-size: 20px; font-weight: 700; line-height: 1.3;}@media (max-width: 639px){.ncbi-alerts h3 {padding-left: 42px;}}</style><script charset="utf-8" src="https://siteintercept.qualtrics.com/dxjsmodule/11.8e0c49f5695c3af1b017.chunk.js?Q_CLIENTVERSION=2.40.2&amp;Q_CLIENTTYPE=web&amp;Q_BRANDID=pubmed.ncbi.nlm.nih.gov"></script><script charset="utf-8" src="https://siteintercept.qualtrics.com/dxjsmodule/7.f771bf31274ceb2ea6db.chunk.js?Q_CLIENTVERSION=2.40.2&amp;Q_CLIENTTYPE=web&amp;Q_BRANDID=pubmed.ncbi.nlm.nih.gov"></script><script charset="utf-8" src="https://siteintercept.qualtrics.com/dxjsmodule/5.12eadb834910efa51961.chunk.js?Q_CLIENTVERSION=2.40.2&amp;Q_CLIENTTYPE=web&amp;Q_BRANDID=nlmenterprise"></script><script charset="utf-8" src="https://siteintercept.qualtrics.com/dxjsmodule/1.e4d377cd6bbdbd2782af.chunk.js?Q_CLIENTVERSION=2.40.2&amp;Q_CLIENTTYPE=web&amp;Q_BRANDID=nlmenterprise"></script></head>
<body>

  
  
    <noscript>
  <div class="no-script-banner" id="no-script-banner">
    <div class="warning-message">
      <div class="warning-message-text">
        This site needs JavaScript to work properly. Please enable it to take advantage of the complete set of features!
      </div>
    </div>
  </div>
</noscript>

    <div class="no-session-banner" id="no-session-banner" hidden="">
  <div class="warning-message">
    <div class="warning-message-text">
      Clipboard, Search History, and several other advanced features are temporarily unavailable.
    </div>
    <button class="close-banner-button" title="Close Clipboard and Search History not available warning banner" ref="linksrc=close_no_session_banner" aria-controls="no-session-banner" aria-label="Close Clipboard and Search History not available warning banner" aria-expanded="true">
    </button>
  </div>
</div>

  

  <a class="usa-skipnav" href="#search-results">
    Skip to main page content
  </a>
  
    <!-- ========== BEGIN HEADER ========== -->
<section class="usa-banner">
  <div class="usa-accordion">
    <header class="usa-banner-header">
      <div class="usa-grid usa-banner-inner">
        <img src="https://cdn.ncbi.nlm.nih.gov/coreutils/uswds/img/favicons/favicon-57.png" alt="U.S. flag">
        <p>An official website of the United States government</p>
        <button class="usa-accordion-button usa-banner-button" aria-expanded="false" aria-controls="gov-banner-top">
          <span class="usa-banner-button-text">Here's how you know</span>
        </button>
      </div>
    </header>
    <div class="usa-banner-content usa-grid usa-accordion-content" id="gov-banner-top" aria-hidden="true">
      <div class="usa-banner-guidance-gov usa-width-one-half">
        <img class="usa-banner-icon usa-media_block-img" src="https://cdn.ncbi.nlm.nih.gov/coreutils/uswds/img/icon-dot-gov.svg" alt="Dot gov">
        <div class="usa-media_block-body">
          <p>
            <strong>The .gov means it’s official.</strong>
            <br>
            Federal government websites often end in .gov or .mil. Before
            sharing sensitive information, make sure you’re on a federal
            government site.
          </p>
        </div>
      </div>
      <div class="usa-banner-guidance-ssl usa-width-one-half">
        <img class="usa-banner-icon usa-media_block-img" src="https://cdn.ncbi.nlm.nih.gov/coreutils/uswds/img/icon-https.svg" alt="Https">
        <div class="usa-media_block-body">
          <p>
            <strong>The site is secure.</strong>
            <br>
            The <strong>https://</strong> ensures that you are connecting to the
            official website and that any information you provide is encrypted
            and transmitted securely.
          </p>
        </div>
      </div>
    </div>
  </div>
</section>
<div class="usa-overlay"></div>
<header class="ncbi-header" role="banner" data-section="Header">

	<div class="usa-grid">
		<div class="usa-width-one-whole">

            <div class="ncbi-header__logo">
                <a href="https://www.ncbi.nlm.nih.gov/" class="logo" aria-label="NCBI Logo" data-ga-action="click_image" data-ga-label="NIH NLM Logo">
                  <img src="https://cdn.ncbi.nlm.nih.gov/coreutils/nwds/img/logos/AgencyLogo.svg" alt="NIH NLM Logo">
                </a>
            </div>

			<div class="ncbi-header__account">
				<a id="account_login" href="https://account.ncbi.nlm.nih.gov/?back_url=https%3A%2F%2Fpubmed.ncbi.nlm.nih.gov%2F%3Fterm%3D%28hypertension%255BTitle%255D%29%2520AND%2520%28food%255BText%2520Word%255D%29%2520%26page%3D2" class="usa-button header-button" style="" data-ga-action="open_menu" data-ga-label="account_menu">Log in</a>
				<button id="account_info" class="header-button" style="display:none" aria-controls="account_popup">
					<span class="fa fa-user" aria-hidden="true"></span>
					<span class="username desktop-only" aria-hidden="true" id="uname_short"></span>
					<span class="sr-only">Show account info</span>
				</button>
			</div>

			<div class="ncbi-popup-anchor">
				<div class="ncbi-popup account-popup" id="account_popup" aria-hidden="true">
					<div class="ncbi-popup-head">
						<button class="ncbi-close-button" data-ga-action="close_menu" data-ga-label="account_menu"><span class="fa fa-times"></span><span class="usa-sr-only">Close</span></button>
						<h4>Account</h4>
					</div>
					<div class="account-user-info">
						Logged in as:<br>
						<b><span class="username" id="uname_long">username</span></b>
					</div>
					<div class="account-links">
						<ul class="usa-unstyled-list">
							<li><a id="account_myncbi" href="https://www.ncbi.nlm.nih.gov/myncbi/" class="set-base-url" data-ga-action="click_menu_item" data-ga-label="account_myncbi">Dashboard</a></li>
							<li><a id="account_pubs" href="https://www.ncbi.nlm.nih.gov/myncbi/collections/bibliography/" class="set-base-url" data-ga-action="click_menu_item" data-ga-label="account_pubs">Publications</a></li>
							<li><a id="account_settings" href="https://www.ncbi.nlm.nih.gov/account/settings/" class="set-base-url" data-ga-action="click_menu_item" data-ga-label="account_settings">Account settings</a></li>
							<li><a id="account_logout" href="https://www.ncbi.nlm.nih.gov/account/signout/?back_url=https%3A//pubmed.ncbi.nlm.nih.gov/%3Fterm%3D%28hypertension%255BTitle%255D%29%2520AND%2520%28food%255BText%2520Word%255D%29%2520%26page%3D2" class="set-base-url" data-ga-action="click_menu_item" data-ga-label="account_logout">Log out</a></li>
						</ul>
					</div>
				</div>
			</div>

		</div>
	</div>
</header>
<div role="navigation" aria-label="access keys">
<a id="nws_header_accesskey_0" href="https://www.ncbi.nlm.nih.gov/guide/browsers/#ncbi_accesskeys" class="usa-sr-only" accesskey="0" tabindex="-1">Access keys</a>
<a id="nws_header_accesskey_1" href="https://www.ncbi.nlm.nih.gov" class="usa-sr-only" accesskey="1" tabindex="-1">NCBI Homepage</a>
<a id="nws_header_accesskey_2" href="/myncbi/" class="set-base-url usa-sr-only" accesskey="2" tabindex="-1">MyNCBI Homepage</a>
<a id="nws_header_accesskey_3" href="#maincontent" class="usa-sr-only" accesskey="3" tabindex="-1">Main Content</a>
<a id="nws_header_accesskey_4" href="#" class="usa-sr-only" accesskey="4" tabindex="-1">Main Navigation</a>
</div>
<section data-section="Alerts">
	<div class="ncbi-alerts-placeholder"></div>
</section>
<!-- ========== END HEADER ========== -->


    <a id="maincontent" aria-label="Main page content below" role="navigation"></a>
    
  <main class="search-page" id="search-page">
    
      <h1 class="usa-sr-only">Search Page</h1>
    
    



<input type="hidden" name="csrfmiddlewaretoken" value="sXcYXzaFLKFHRX0o0yUeKm8kYyZpxgiSZsGy4hvUQ650c0B9IvSjrwtOec8h6uM9">
<form action="/" method="get" autocomplete="off" class="usa-search usa-search-big search-form " id="search-form" role="search">
  <div class="inner-wrap">
    <a class="pubmed-logo" aria-label="Pubmed Logo" href="/" data-ga-category="featured_link" data-ga-action="pubmed_logo">
      
      
        <img src="https://cdn.ncbi.nlm.nih.gov/pubmed/6aa07a65-6caa-4bbc-acaa-48623b669c29/core/images/pubmed-logo-blue.svg" alt="pubmed logo">
      
    </a>

    <a href="#" class="search-input-trigger" data-alt-title="Hide search bar" title="Show search bar" aria-label="Show search bar" aria-hidden="true" tabindex="-1">
    </a>

    <div role="search" class="search-input">
      

<div class="form-field ">

  
  <label class="usa-sr-only" for="id_term">
    Search:
  </label>


  
  <span class="twitter-typeahead ncbi-autocomplete"><input type="search" name="term" value="(hypertension[Title]) AND (food[Text Word])" data-skip-ie-scroll-to-top="" data-replace-term-with-exact="False" data-exact-query="(hypertension[Title]) AND (food[Text Word])" placeholder="" class="term-input tt-input" required="required" id="id_term" spellcheck="false" dir="auto" style="position: relative; vertical-align: top;" aria-owns="id_term_listbox" aria-controls="id_term_listbox" role="combobox" aria-autocomplete="list" aria-expanded="false"><span role="status" aria-live="polite" style="position: absolute; padding: 0px; border: 0px; height: 1px; width: 1px; margin-bottom: -1px; margin-right: -1px; overflow: hidden; clip: rect(0px, 0px, 0px, 0px); white-space: nowrap;">0 results are available, use up and down arrow keys to navigate.</span><pre aria-hidden="true" style="position: absolute; visibility: hidden; white-space: pre; font-family: &quot;system-ui&quot;, -apple-system, &quot;Segoe UI&quot;, Roboto, Oxygen, Ubuntu, Cantarell, &quot;Fira Sans&quot;, &quot;Droid Sans&quot;, &quot;Helvetica Neue&quot;, sans-serif; font-size: 16px; font-style: normal; font-variant: normal; font-weight: 400; word-spacing: 0px; letter-spacing: 0px; text-indent: 0px; text-rendering: auto; text-transform: none;"></pre><div role="listbox" class="tt-menu tt-empty" id="id_term_listbox" style="position: absolute; top: 100%; left: 0px; z-index: 100; display: none;" aria-expanded="false"><div role="presentation" class="tt-dataset tt-dataset-0"></div></div></span><a href="#" class="clear-btn active" aria-label="Clear search input" title="Clear search input" role="button" data-pinger-ignore=""></a><button type="submit" class="search-btn" aria-label="Search" data-pinger-ignore=""><span class="usa-search-submit-text">Search</span></button>


  
    
  
</div>

    </div>
    
    <!-- Create alert and Create RSS are buttons that look like links -->
    <!-- Better for them to look like buttons but no space -->
    <div class="search-links-wrapper ">
      <div class="search-links">
        <a href="/advanced/" class="search-input-link adv-search-link" data-ga-category="featured_link" data-ga-action="adv_search">Advanced</a>
        
          
            <a id="search-create-alert" href="https://account.ncbi.nlm.nih.gov/?back_url=https%3A%2F%2Fpubmed.ncbi.nlm.nih.gov%2F%3Fterm%3D%28hypertension%255BTitle%255D%29%2520AND%2520%28food%255BText%2520Word%255D%29%2520%26page%3D2%23open-saved-search-panel" class="saved-search-auth-url search-input-link" data-ga-category="featured_link" data-ga-action="alert">Create alert</a>
          
        
        
          <a id="search-create-rss" href="#" role="button" class="rss-panel-trigger search-input-link" data-ga-category="featured_link" data-ga-action="rss" data-ga-label="open">
            <span>Create RSS</span>
          </a>
        
        <a href="/clipboard/" class="search-input-link clipboard-link hidden" data-ga-category="featured_link" data-ga-action="clipboard">
          Clipboard <span class="amount-in-clipboard"></span>
        </a>
      </div>
      
        <span class="search-input-link user-guide-link">
          <a href="/help/" data-ga-category="featured_link" data-ga-action="user_guide">
            User Guide
          </a>
        </span>
      
    </div>
  </div>

  
    <div class="search-options">
  <div class="inner-wrap">
    <div class="filters">
  <button class="filters-trigger" title="Filters" type="button">
    <span class="filter-button-label">
      Filters

      
        
        <span class="amount">0</span>
      
    </span>
  </button>

  
    <button class="timeline-trigger" title="Publications timeline" type="button">
      <span class="timeline-button-label">
        Timeline
      </span>
    </button>
  

  <div class="selected-filters">
    <!-- Dynamic JS content -->
    

    
  </div>
</div>


    <!-- Hidden form inputs -->
    <div class="hidden-fields">
      

<div class="spell-check">
  
    <input type="hidden" name="ac" data-on-value="yes" data-off-value="no" value="yes" data-initial-value="yes" id="id_ac">
  
</div>
      

<div class="cauthor-id">
  
    <input type="hidden" name="cauthor_id" value="None" data-initial-value="None" id="id_cauthor_id">
  
</div>
      

<div class="user-filter">
  
    <input type="hidden" name="user_filter" value="" data-initial-value="" id="id_user_filter">
  
</div>
      

<div class="schema">
  
    <input type="hidden" name="schema" data-on-value="all" data-off-value="none" value="none" data-initial-value="none" id="id_schema">
  
</div>
      

<div class="page-num">
  
    <input type="hidden" name="page" value="2" data-initial-value="1" id="id_page">
  
</div>
      

<div class="whatsnew">
  
    <input type="hidden" name="whatsnew" value="None" data-initial-value="None" id="id_whatsnew">
  
</div>
      

<div class="show-snippets">
  
    <input type="hidden" name="show_snippets" data-on-value="on" data-off-value="off" value="on" data-initial-value="on" id="id_show_snippets">
  
</div>
    </div>

    <div class="result-display">
      


<div class="sorting-options">
  <div class="sort-dropdown">
    <span class="option-label">
      Sort by:
    </span>
    <select name="sort" id="id_sort" class="sort-selector" title="Change sort order" aria-label="Sort by" data-initial-value="relevance" data-skipped-value="none" data-saved-value="">
      
        
          <option class="sort-option" value="relevance" data-name="sort" data-ga-action="select" data-ga-category="sort option" data-ga-label="relevance">
            Best match
          </option>
        
          <option class="sort-option" value="date" data-name="sort" data-ga-action="select" data-ga-category="sort option" data-ga-label="date">
            Most recent
          </option>
        
          <option class="sort-option" value="pubdate" data-name="sort" data-ga-action="select" data-ga-category="sort option" data-ga-label="pubdate">
            Publication date
          </option>
        
          <option class="sort-option" value="fauth" data-name="sort" data-ga-action="select" data-ga-category="sort option" data-ga-label="fauth">
            First author
          </option>
        
          <option class="sort-option" value="jour" data-name="sort" data-ga-action="select" data-ga-category="sort option" data-ga-label="jour">
            Journal
          </option>
        
      
    </select>
    
      
      <div class="hidden-field">
        <input type="hidden" name="sort_order" data-initial-value="desc" data-saved-value="" value="desc" id="id_sort_order">
      </div>
    
  </div>
</div>
      



<div class="display-options dropdown-block">
  <button class="trigger" type="button" title="Change format and items per page" data-ga-category="display_options" data-ga-action="display_options_dialog" aria-expanded="false">
    <span class="button-label">Display options</span>
  </button>

  <div class="dropdown dropdown-container" aria-hidden="true">
    <div class="title">
      Display options
    </div>

    <div class="content">
      
        
        <div class="format-container">
          <span class="option-label">
            Format
          </span>
          <select name="format" data-initial-value="summary" aria-label="Display format" data-saved-value="summary" id="id_format">
  <option value="summary">Summary</option>

  <option value="abstract">Abstract</option>

  <option value="pubmed">PubMed</option>

  <option value="pmid">PMID</option>

</select>
        </div>
      

      
        <div class="per-page-container">
          <span class="option-label">
            Per page
          </span>
          <select name="size" data-saved-value="" data-initial-value="10" aria-label="Per page" id="id_size">
  <option value="10">10</option>

  <option value="20">20</option>

  <option value="50">50</option>

  <option value="100">100</option>

  <option value="200">200</option>

</select>
        </div>
      
      <div class="show-snippets-container">
        <span class="option-label">
          Abstract snippets
        </span>
        <!-- this input needs to not have a name so it's not submitted -->
        <!-- on change proper value is propagated to hidden input which is submitted -->
        <ul class="radio-group-items">
          <li>
            <input type="radio" aria-label="Show snippets" id="snippets-show" class="snippets-show" value="show" checked="">
            <label for="snippets-show">Show</label>
          </li>
          <li>
            <input type="radio" aria-label="Hide snippets" id="snippets-hide" class="snippets-hide" value="hide">
            <label for="snippets-hide">Hide</label>
          </li>
        </ul>
      </div>
    </div>
  </div>
</div>

    </div>

    <div class="multiple-results-actions " role="region" aria-label="save, email, send to">
  <button id="save-results-panel-trigger" type="button" class="save-results save-results-panel-trigger" aria-expanded="false" aria-controls="save-action-panel" data-ga-category="save_share" data-ga-action="save" data-ga-label="open">
      Save
    </button><button id="email-results-panel-trigger" type="button" class="email-results email-results-login" aria-expanded="false" aria-controls="email-action-panel" data-login-url="https://account.ncbi.nlm.nih.gov/?back_url=https%3A%2F%2Fpubmed.ncbi.nlm.nih.gov%2F%3Fterm%3D%28hypertension%255BTitle%255D%29%2520AND%2520%28food%255BText%2520Word%255D%29%2520%26page%3D2%23open-email-panel" data-ga-category="save_share" data-ga-action="email" data-ga-label="open">
      Email
    </button><div class="more-actions dropdown-block"><button id="more-actions-trigger" type="button" class="trigger more-actions-trigger" ref="linksrc=show_moreactions_btn" aria-label="Send to" aria-controls="more-actions-dropdown" aria-expanded="false">Send to</button><div id="more-actions-dropdown" class="dropdown dropdown-container" aria-hidden="true"><div class="content"><ul class="more-actions-links"><li><a class="clipboard-panel-trigger dropdown-block-link " href="#" role="button" data-ga-category="save_share" data-ga-action="clipboard" data-ga-label="send">
                  Clipboard
                </a></li><li><a role="button" class="dropdown-block-link bibliography-trigger-target" href="https://account.ncbi.nlm.nih.gov/?back_url=https%3A%2F%2Fpubmed.ncbi.nlm.nih.gov%2F%3Fterm%3D%28hypertension%255BTitle%255D%29%2520AND%2520%28food%255BText%2520Word%255D%29%2520%26page%3D2%23open-bibliography-panel">My Bibliography</a></li><li><a role="button" class="dropdown-block-link collections-trigger-target" href="https://account.ncbi.nlm.nih.gov/?back_url=https%3A%2F%2Fpubmed.ncbi.nlm.nih.gov%2F%3Fterm%3D%28hypertension%255BTitle%255D%29%2520AND%2520%28food%255BText%2520Word%255D%29%2520%26page%3D2%23open-collections-panel">Collections</a></li><li><a role="button" class="citation-manager-panel-trigger dropdown-block-link citation-manager-trigger-target" href="#">Citation manager</a></li></ul></div></div></div>
</div>


  </div>
</div>

  
</form>


    
      <div id="save-action-panel" class="save-action-panel action-panel" aria-hidden="true" role="dialog" aria-labelledby="action-panel-heading" tabindex="-1" style="left: 0px;">
  <div class="inner-wrap">
    <h2 class="action-panel-heading">
      Save citations to file
    </h2>
    <form id="save-action-panel-form" class="action-panel-content action-form" action="/results-export-ids/" data-by-search-action="/results-export-search-data/" data-by-ids-action="/results-export-ids/" method="post" data-by-search-method="post" data-by-ids-method="post">

      <input type="hidden" name="csrfmiddlewaretoken" value="sXcYXzaFLKFHRX0o0yUeKm8kYyZpxgiSZsGy4hvUQ650c0B9IvSjrwtOec8h6uM9">

      
        <div class="selection-selector-container">
  <input type="hidden" name="page-result-ids" value="35910428,26449129,35417736,39975789,40405724,31023830,33541612,28818842,39067698,23627503">

  <input type="hidden" name="selected-result-ids" class="custom-selected-results-ids" value="">

  <div class="action-panel-control-wrap">
    <label for="save-action-selection" class="action-panel-label">
      Selection:
    </label>
    <select id="save-action-selection" name="results-selection" class="action-panel-selector custom-results-selector" data-custom-selection-option="custom-results-selection" data-page-selection-option="this-page" data-all-selection-option="all-results" data-max-results-for-warning-message="10000" data-max-results-for-info-message="10000" data-default-selection-option="this-page" aria-describedby="save-selector-error-message">
      
        <option selected="" value="this-page" data-mult-page-title="All displayed results" data-single-page-title="All results on this page">All results on this page</option>
        
          <option value="all-results">All results</option>
        
        <option value="custom-results-selection" data-label="Selection">Selection</option>
      
    </select>
  </div>
  <div id="save-selector-error-message" class="usa-input-error-message selection-validation-message" role="alert" data-alert-text="No results selected. Use checkboxes to select search results." style="display: none;"></div>
  
  
</div>

      

      <div class="action-panel-control-wrap">
        <label for="save-action-format" class="action-panel-label">
          Format:
        </label>
        <select id="save-action-format" name="results-format" class="action-panel-selector">
          <option value="summary-text">Summary (text)</option>
          <option value="pubmed-text">PubMed</option>
          <option value="pmid">PMID</option>
          <option value="abstract">Abstract (text)</option>
          <option value="csv">CSV</option>
        </select>
      </div>

      <div class="action-panel-actions">
        <button class="action-panel-submit" type="submit" data-loading-label="Saving..." data-ga-category="save_share" data-ga-action="save" data-ga-label="save">
          Create file
        </button>
        <button class="action-panel-cancel" aria-label="Close 'Save citations to file' panel" ref="linksrc=close_save_panel" aria-controls="save-action-panel" aria-expanded="false" data-ga-category="save_share" data-ga-action="save" data-ga-label="cancel">
          Cancel
        </button>
      </div>
    </form>
  </div>
</div>

      




<div id="email-action-panel" class="email-action-panel action-panel" aria-hidden="true" role="dialog" aria-labelledby="action-panel-heading" tabindex="-1" data-email-open-panel-enabled="false" data-email-open-panel-url-hash="#open-email-panel" style="left: 0px;">
  <div class="inner-wrap">
    <h2 class="action-panel-heading">
      Email citations
    </h2>
    
      <div class="email-login-message usa-alert usa-alert-slim usa-alert-warning">
        <div class="usa-alert-body">
          <div class="usa-alert-text">
            Email address has not been verified. Go to
            <a href="https://account.ncbi.nlm.nih.gov/settings/" target="_blank" rel="noopener" class="email-verification-link" data-ga-category="save_share" data-ga-action="email" data-ga-label="email_verification_link">
              My NCBI account settings
            </a>
            to confirm your email and then refresh this page.
          </div>
        </div>
      </div>
    
    <form id="email-action-panel-form" class="action-panel-content action-form" action="/send-email/" data-by-search-action="/results-export-email-by-search-data/" data-by-ids-action="/send-email/" data-by-search-method="post" data-by-ids-method="post" method="post">
      <input type="hidden" name="csrfmiddlewaretoken" value="sXcYXzaFLKFHRX0o0yUeKm8kYyZpxgiSZsGy4hvUQ650c0B9IvSjrwtOec8h6uM9">
      
      <div class="action-panel-control-wrap">
        <span class="action-panel-label">
          To:
        </span>
        <span class="email-to" id="email-to" aria-label="Recipient Email Address">
          
        </span>
      </div>

      <div class="action-panel-control-wrap">
        <label for="email-subject" class="action-panel-label">
          Subject:
        </label>
        <input type="text" id="email-subject" class="email-subject" aria-label="Email subject" value="(hypertension[Title]) AND (food[Text Word])" data-initial-value="(hypertension[Title]) AND (food[Text Word])" maxlength="50" pattern="[^&quot;&amp;=&lt;&gt;\/]*" title="The following characters are not allowed in the Subject field: &quot;&amp;=&lt;&gt;/">
      </div>

      <div class="action-panel-control-wrap">
        <label for="email-body" class="action-panel-label">
          Body:
        </label>
        <textarea id="email-body" class="email-body" aria-label="Email body" maxlength="300" rows="3" placeholder="include any optional text for your email" pattern="[^&quot;&amp;=&lt;&gt;\/]*" title="The following characters are not allowed in the Body field: &quot;&amp;=&lt;&gt;/"></textarea>
      </div>

      
        
        <div class="selection-selector-container">
  <input type="hidden" name="page-result-ids" value="35910428,26449129,35417736,39975789,40405724,31023830,33541612,28818842,39067698,23627503">

  <input type="hidden" name="selected-result-ids" class="custom-selected-results-ids" value="">

  <div class="action-panel-control-wrap">
    <label for="email-action-selection" class="action-panel-label">
      Selection:
    </label>
    <select id="email-action-selection" name="results-selection" class="action-panel-selector custom-results-selector" data-custom-selection-option="custom-results-selection" data-page-selection-option="this-page" data-all-selection-option="all-results" data-max-results-for-warning-message="1000" data-max-results-for-info-message="200" data-default-selection-option="this-page" aria-describedby="email-selector-error-message email-selector-warning-message email-selector-info-message">
      
        <option selected="" value="this-page" data-mult-page-title="All displayed results" data-single-page-title="All results on this page">All results on this page</option>
        
          <option value="all-results">All results</option>
        
        <option value="custom-results-selection" data-label="Selection">Selection</option>
      
    </select>
  </div>
  <div id="email-selector-error-message" class="usa-input-error-message selection-validation-message" role="alert" data-alert-text="No results selected. Use checkboxes to select search results." style="display: none;"></div>
  
    <div id="email-selector-warning-message" class="selection-warning-message" role="alert" data-warning-text="Only the first 1,000 citations will be sent in your email. You will receive citations in multiple emails." style="display: none;"></div>
  
  
    <div id="email-selector-info-message" class="selection-info-message" role="alert" data-info-text="You will receive citations in multiple emails." style="display: none;"></div>
  
</div>

      

      <div class="action-panel-control-wrap">
        <label for="email-citation-format" class="action-panel-label">
          Format:
        </label>
        <select id="email-citation-format" name="citation-format" class="action-panel-selector email-citation-format">
          <option selected="selected" value="summary">Summary</option>
          <option value="summary-text">Summary (text)</option>
          <option value="abstract">Abstract</option>
          <option value="abstract-text">Abstract (text)</option>
          
        </select>
      </div>
      <div class="include-supplemental-container" style="display: none;">
        <input type="checkbox" aria-label="Include MeSH and other data" name="include-supplemental" id="email-include-supplemental" class="email-include-supplemental">
        <label for="email-include-supplemental" class="email-include-supplemental-label">
          MeSH and other data
        </label>
      </div>

      
        
<div class="form-field recaptcha ">
  

  
    
  

  

  
</div>
<div id="captcha-error-message" class="usa-input-error-message captcha-validation-message" role="alert"></div>

      

      <div class="action-panel-actions">
        <button class="action-panel-submit" type="submit" data-loading-label="Sending..." data-ga-category="save_share" data-ga-action="email" data-ga-label="send" disabled="">
          Send email
        </button>
        <button class="action-panel-cancel" aria-label="Close 'Email citations' panel" ref="linksrc=close_email_panel" aria-controls="email-action-panel" aria-expanded="false" data-ga-category="save_share" data-ga-action="email" data-ga-label="cancel">
          Cancel
        </button>
      </div>
      <input type="hidden" name="email-search-details" value="(hypertension[Title]) AND (food[Text Word])">
      <input type="hidden" name="email-search-details-hash" value="028147f0edae39facbd46b688b05a1375fe4bdccdb364cc32b1317331628e84b">
    </form>
  </div>
</div>

      <div id="clipboard-panel" class="clipboard-panel action-panel" aria-hidden="true" style="left: 0px;">
  <div class="inner-wrap">
    <h3 class="action-panel-heading">
      Send citations to clipboard
    </h3>
    <form id="clipboard-panel-form" class="action-panel-content action-form" action="/"> 

      
      <div class="selection-selector-container">
  <input type="hidden" name="page-result-ids" value="35910428,26449129,35417736,39975789,40405724,31023830,33541612,28818842,39067698,23627503">

  <input type="hidden" name="selected-result-ids" class="custom-selected-results-ids" value="">

  <div class="action-panel-control-wrap">
    <label for="clipboard-action-selection" class="action-panel-label">
      Selection:
    </label>
    <select id="clipboard-action-selection" name="results-selection" class="action-panel-selector custom-results-selector" data-custom-selection-option="custom-results-selection" data-page-selection-option="this-page" data-all-selection-option="all-results" data-max-results-for-warning-message="500" data-max-results-for-info-message="500" data-default-selection-option="this-page" aria-describedby="clipboard-selector-error-message clipboard-selector-warning-message">
      
        <option selected="" value="this-page" data-mult-page-title="All displayed results" data-single-page-title="All results on this page">All results on this page</option>
        
          <option value="all-results">All results</option>
        
        <option value="custom-results-selection" data-label="Selection">Selection</option>
      
    </select>
  </div>
  <div id="clipboard-selector-error-message" class="usa-input-error-message selection-validation-message" role="alert" data-alert-text="No results selected. Use checkboxes to select search results." style="display: none;"></div>
  
    <div id="clipboard-selector-warning-message" class="selection-warning-message" role="alert" data-warning-text="Only the first 500 items will be sent to clipboard." style="display: none;"></div>
  
  
</div>


      <div class="action-panel-actions">
        <button class="action-panel-submit" type="submit" data-loading-label="Sending..." data-ga-category="save_share" data-ga-action="clipboard" data-ga-label="send">
          Send
        </button>
        <button class="action-panel-cancel" aria-label="Close 'Send citations to clipboard' panel" ref="linksrc=close_clipboard_panel" aria-controls="clipboard-panel" aria-expanded="false" data-ga-category="save_share" data-ga-action="clipboard" data-ga-label="cancel">
          Cancel
        </button>
      </div>
    </form>
  </div>
</div>

      <div id="collections-action-panel" class="collections-action-panel action-panel in-progress-dots-panel" aria-hidden="true" data-collections-open-panel-enabled="false" data-collections-open-panel-url-hash="#open-collections-panel" style="left: 0px;">
  <div class="inner-wrap">
    <h3 class="action-panel-heading">
      Add to Collections
    </h3>
    

<form id="collections-action-panel-form" class="collections-action-panel-form action-panel-content action-form action-panel-smaller-selectors" data-existing-collections-url="/list-existing-collections/" data-add-to-existing-collection-url="/add-to-existing-collection/" data-create-and-add-to-new-collection-url="/create-and-add-to-new-collection/" data-get-article-ids-by-search-url="/get-article-ids-by-search/" data-myncbi-max-collection-name-length="100" data-add-to-collection-max-amount="1000" data-collections-root-url="https://www.ncbi.nlm.nih.gov/myncbi/collections/">

  <input type="hidden" name="csrfmiddlewaretoken" value="sXcYXzaFLKFHRX0o0yUeKm8kYyZpxgiSZsGy4hvUQ650c0B9IvSjrwtOec8h6uM9">

  
    <div class="results-selector-wrap">
      <div class="selection-selector-container">
  <input type="hidden" name="page-result-ids" value="35910428,26449129,35417736,39975789,40405724,31023830,33541612,28818842,39067698,23627503">

  <input type="hidden" name="selected-result-ids" class="custom-selected-results-ids" value="">

  <div class="action-panel-control-wrap">
    <label for="collection-action-selection" class="action-panel-label">
      Selection:
    </label>
    <select id="collection-action-selection" name="results-selection" class="action-panel-selector custom-results-selector" data-custom-selection-option="custom-results-selection" data-page-selection-option="this-page" data-all-selection-option="all-results" data-max-results-for-warning-message="1000" data-max-results-for-info-message="1000" data-default-selection-option="this-page" aria-describedby="collection-selector-error-message collection-selector-warning-message">
      
        <option selected="" value="this-page" data-mult-page-title="All displayed results" data-single-page-title="All results on this page">All results on this page</option>
        
          <option value="all-results">All results</option>
        
        <option value="custom-results-selection" data-label="Selection">Selection</option>
      
    </select>
  </div>
  <div id="collection-selector-error-message" class="usa-input-error-message selection-validation-message" role="alert" data-alert-text="No results selected. Use checkboxes to select search results." style="display: none;"></div>
  
    <div id="collection-selector-warning-message" class="selection-warning-message" role="alert" data-warning-text="Only the first 1,000 citations will be added to collection." style="display: none;"></div>
  
  
</div>

    </div>
  

  <div class="choice-group" role="radiogroup">
    <ul class="radio-group-items">
      <li>
        <input type="radio" id="collections-action-panel-new" class="collections-new" name="collections" value="new" data-ga-category="save_share" data-ga-action="collections" data-ga-label="collections_radio_new">
        <label for="collections-action-panel-new">Create a new collection</label>
      </li>
      <li>
        <input type="radio" id="collections-action-panel-existing" class="collections-existing" name="collections" value="existing" checked="true" data-ga-category="save_share" data-ga-action="collections" data-ga-label="collections_radio_existing">
        <label for="collections-action-panel-existing">Add to an existing collection</label>
      </li>
    </ul>
  </div>

  <div class="controls-wrapper">
    <div class="action-panel-control-wrap new-collections-controls">
      <label for="collections-action-panel-add-to-new" class="action-panel-label required-field-asterisk">
        Name your collection:
      </label>
      <input type="text" name="add-to-new-collection" id="collections-action-panel-add-to-new" class="collections-action-add-to-new" pattern="[^&quot;&amp;=&lt;&gt;\/]*" title="The following characters are not allowed in the Name field: &quot;&amp;=&lt;&gt;/" maxlength="100" data-ga-category="save_share" data-ga-action="create_collection" data-ga-label="non_favorties_collection">
      <div class="collections-new-name-too-long usa-input-error-message selection-validation-message">
        Name must be less than 100 characters
      </div>
    </div>
    <div class="action-panel-control-wrap existing-collections-controls">
      <label for="collections-action-panel-add-to-existing" class="action-panel-label">
        Choose a collection:
      </label>
      <select id="collections-action-panel-add-to-existing" class="action-panel-selector collections-action-add-to-existing" data-ga-category="save_share" data-ga-action="select_collection" data-ga-label="($('#collections-action-add-to-existing').val() === 'Favorites') ? 'Favorites' : 'non_favorites_collection'">
      </select>
      <div class="collections-retry-load-on-error usa-input-error-message selection-validation-message">
        Unable to load your collection due to an error<br>
        <a href="#">Please try again</a>
      </div>
    </div>
  </div>

  <div class="action-panel-actions">
    <button class="action-panel-submit" type="submit" data-loading-label="Adding..." data-pinger-ignore="" data-ga-category="save_share" data-ga-action="collections" data-ga-label="add" disabled="">
      Add
    </button>
    <button class="action-panel-cancel" aria-label="Close 'Add to Collections' panel" ref="linksrc=close_collections_panel" aria-controls="collections-action-panel" aria-expanded="false" data-ga-category="save_share" data-ga-action="collections" data-ga-label="cancel">
      Cancel
    </button>
  </div>
</form>
  </div>
<div class="dots-loading-indicator loading-indicator">
        <div class="dot dot-1"></div>
        <div class="dot dot-2"></div>
        <div class="dot dot-3"></div>
      </div></div>

      <div id="bibliography-action-panel" class="bibliography-action-panel action-panel in-progress-dots-panel" aria-hidden="true" data-bibliography-open-panel-enabled="false" data-bibliography-open-panel-url-hash="#open-bibliography-panel" style="left: 0px;">
  <div class="inner-wrap">
    <h3 class="action-panel-heading">
      Add to My Bibliography
    </h3>
    <form id="bibliography-action-panel-form" class="bibliography-action-panel-form action-panel-content action-form action-panel-smaller-selectors" data-add-to-bibliography-max-amount="100" data-add-to-bibliography-batch-size="10" data-bibliography-delegates-url="/list-bibliography-delegates/" data-add-to-bibliography-url="/add-to-bibliography/" data-get-article-ids-by-search-url="/get-article-ids-by-search/" data-mybib-root-url="https://www.ncbi.nlm.nih.gov/myncbi/collections/mybibliography/">

      <input type="hidden" name="csrfmiddlewaretoken" value="sXcYXzaFLKFHRX0o0yUeKm8kYyZpxgiSZsGy4hvUQ650c0B9IvSjrwtOec8h6uM9">

      
        <div class="results-selector-wrap">
          <div class="selection-selector-container">
  <input type="hidden" name="page-result-ids" value="35910428,26449129,35417736,39975789,40405724,31023830,33541612,28818842,39067698,23627503">

  <input type="hidden" name="selected-result-ids" class="custom-selected-results-ids" value="">

  <div class="action-panel-control-wrap">
    <label for="bibliography-action-selection" class="action-panel-label">
      Selection:
    </label>
    <select id="bibliography-action-selection" name="results-selection" class="action-panel-selector custom-results-selector" data-custom-selection-option="custom-results-selection" data-page-selection-option="this-page" data-all-selection-option="all-results" data-max-results-for-warning-message="100" data-max-results-for-info-message="100" data-default-selection-option="this-page" aria-describedby="bibliography-selector-error-message bibliography-selector-warning-message">
      
        <option selected="" value="this-page" data-mult-page-title="All displayed results" data-single-page-title="All results on this page">All results on this page</option>
        
          <option value="all-results">All results</option>
        
        <option value="custom-results-selection" data-label="Selection">Selection</option>
      
    </select>
  </div>
  <div id="bibliography-selector-error-message" class="usa-input-error-message selection-validation-message" role="alert" data-alert-text="No results selected. Use checkboxes to select search results." style="display: none;"></div>
  
    <div id="bibliography-selector-warning-message" class="selection-warning-message" role="alert" data-warning-text="Only the first 100 citations will be added to bibliography." style="display: none;"></div>
  
  
</div>

        </div>
      

      <div class="action-panel-control-wrap bibliographies-controls">
        <div class="choice-group">
          <ul class="bibliographies-action-add radio-group-items">
            <li>
              <input name="bibliography" id="my-bibliography" class="my-bibliography" type="radio" checked="">
              <label for="my-bibliography">My Bibliography</label>
            </li>
          </ul>
        </div>
      </div>

      <div class="bibliographies-retry-load-on-error usa-input-error-message selection-validation-message">
        Unable to load your delegates due to an error<br>
        <a href="#">Please try again</a>
      </div>

      <div class="action-panel-actions">
        <button class="action-panel-submit" type="submit" data-loading-label="Adding..." data-pinger-ignore="">
          Add
        </button>
        <button class="action-panel-cancel" aria-label="Close 'Add to bibliography' panel" ref="linksrc=close_bibliography_panel" aria-controls="bibliography-action-panel" aria-expanded="false" data-ga-category="save_share" data-ga-action="mybib" data-ga-label="cancel">
          Cancel
        </button>
      </div>
    </form>
  </div>
<div class="dots-loading-indicator loading-indicator">
        <div class="dot dot-1"></div>
        <div class="dot dot-2"></div>
        <div class="dot dot-3"></div>
      </div></div>

      <div id="citation-manager-action-panel" class="citation-manager-action-panel action-panel" aria-hidden="true" style="left: 0px;">
  <div class="inner-wrap">
    <h2 class="action-panel-heading">
      Create a file for external citation management software
    </h2>
    <form id="citation-manager-action-panel-form" class="action-panel-content action-form" action="/results-export-ids/" data-by-search-action="/results-export-search-data/" data-by-ids-action="/results-export-ids/" method="post" data-by-search-method="post" data-by-ids-method="post">

      <input type="hidden" name="csrfmiddlewaretoken" value="sXcYXzaFLKFHRX0o0yUeKm8kYyZpxgiSZsGy4hvUQ650c0B9IvSjrwtOec8h6uM9">

      
        <div class="selection-selector-container">
  <input type="hidden" name="page-result-ids" value="35910428,26449129,35417736,39975789,40405724,31023830,33541612,28818842,39067698,23627503">

  <input type="hidden" name="selected-result-ids" class="custom-selected-results-ids" value="">

  <div class="action-panel-control-wrap">
    <label for="citation-manager-action-selection" class="action-panel-label">
      Selection:
    </label>
    <select id="citation-manager-action-selection" name="results-selection" class="action-panel-selector custom-results-selector" data-custom-selection-option="custom-results-selection" data-page-selection-option="this-page" data-all-selection-option="all-results" data-max-results-for-warning-message="10000" data-max-results-for-info-message="10000" data-default-selection-option="this-page" aria-describedby="citation-manager-selector-error-message">
      
        <option selected="" value="this-page" data-mult-page-title="All displayed results" data-single-page-title="All results on this page">All results on this page</option>
        
          <option value="all-results">All results</option>
        
        <option value="custom-results-selection" data-label="Selection">Selection</option>
      
    </select>
  </div>
  <div id="citation-manager-selector-error-message" class="usa-input-error-message selection-validation-message" role="alert" data-alert-text="No results selected. Use checkboxes to select search results." style="display: none;"></div>
  
  
</div>

      

      <input name="results-format" type="hidden" value="pubmed">

      <div class="action-panel-actions">
        <button class="action-panel-submit" type="submit" data-loading-label="Sending..." data-ga-category="save_share" data-ga-action="citation_manager" data-ga-label="save">
          Create file
        </button>
        <button class="action-panel-cancel" aria-label="Close 'Send citations to citation manager' panel" ref="linksrc=close_citation_manager_panel" aria-controls="citation-manager-action-panel" aria-expanded="false" data-ga-category="save_share" data-ga-action="citation_manager" data-ga-label="cancel">
          Cancel
        </button>
      </div>
    </form>
  </div>
</div>

      


<div id="saved-search-action-panel" class="saved-search-action-panel action-panel " aria-hidden="true" data-saved-search-open-panel-enabled="false" data-saved-search-open-panel-url-hash="#open-saved-search-panel">
  <div class="inner-wrap">
    <h2 class="action-panel-heading">
      Your saved search
    </h2>

    <form id="saved-search-action-panel-form" class="saved-search-action-panel-form action-panel-content action-form" data-create-saved-search-url="/create-saved-search/" data-try-search-terms-url="/try-search-term/" data-saved-search-root-url="https://www.ncbi.nlm.nih.gov/myncbi/searches/">

      <input type="hidden" name="csrfmiddlewaretoken" value="sXcYXzaFLKFHRX0o0yUeKm8kYyZpxgiSZsGy4hvUQ650c0B9IvSjrwtOec8h6uM9">

      <div class="action-panel-control-wrap">
        <label for="saved-search-name" class="action-panel-label saved-search-name-label required-field-asterisk">
          Name of saved search:
        </label>
        <input maxlength="200" type="text" name="saved-search-name" id="saved-search-name" class="saved-search-name" value="(hypertension[Title]) AND (food[Text Word])" required="" pattern="[^&quot;&amp;=&lt;&gt;\/]*" title="The following characters are not allowed in the Name field: &quot;&amp;=&lt;&gt;/">
      </div>

      <div class="action-panel-control-wrap">
        <label for="saved-search-term" class="action-panel-label required-field-asterisk">
          Search terms:
        </label>
        <textarea name="saved-search-term" id="saved-search-term" class="saved-search-term" required="">(hypertension[Title]) AND (food[Text Word])</textarea>
      </div>
      <div class="test-search-term-wrap">
        <a href="#" class="try-search-term">Test search terms</a>
      </div>
      <div class="choice-group action-panel-extra-margin-top">
        <span class="action-panel-label" id="fieldset-label">
          Would you like email updates of new search results?
        </span>
        <fieldset id="saved-search-alert" aria-describedby="fieldset-label">
          <legend class="usa-sr-only">Saved Search Alert Radio Buttons</legend>
          <ul class="radio-group-items">
            <li>
              <input type="radio" id="saved-search-alert-yes" class="saved-search-alert-yes" name="saved-search-alert" value="yes" checked="">
              <label for="saved-search-alert-yes" class="action-panel-label">Yes</label>
            </li>
            <li>
              <input aria-label="No radio input" type="radio" id="saved-search-alert-no" class="saved-search-alert-no" name="saved-search-alert" value="no">
              <label for="saved-search-alert-no" class="action-panel-label">No</label>
            </li>
          </ul>
        </fieldset>
      </div>

      <div class="alert-schedule-wrap">
        <div class="action-panel-control-wrap">
          <label class="action-panel-label">
            Email:
          </label>
          <span aria-label="Email address" id="saved-search-email" class="action-panel-label"><span class="action-panel-label-bold"></span> (<a class="myncbi-account-settings" href="https://www.ncbi.nlm.nih.gov/account/settings/">change</a>)</span>
        </div>
        <div class="action-panel-control-wrap action-panel-extra-margin-top">
          <label for="saved-search-frequency" class="action-panel-label">
            Frequency:
          </label>
          <select id="saved-search-frequency" class="no-border-panel-selector saved-search-frequency">
            <option value="monthly">Monthly</option>
            <option value="weekly">Weekly</option>
            <option value="daily">Daily</option>
          </select>
        </div>
        <div class="action-panel-control-wrap saved-search-monthly-additional">
          <label for="saved-search-monthly-on-day" class="action-panel-label">
            Which day?
          </label>
          <select id="saved-search-monthly-on-day" class="no-border-panel-selector">
            <option value="Sunday">The first Sunday</option>
            <option value="Monday">The first Monday</option>
            <option value="Tuesday">The first Tuesday</option>
            <option value="Wednesday">The first Wednesday</option>
            <option value="Thursday">The first Thursday</option>
            <option value="Friday">The first Friday</option>
            <option value="Saturday">The first Saturday</option>
            <option value="day">The first day</option>
            <option value="weekday">The first weekday</option>
          </select>
        </div>
        <div class="action-panel-control-wrap saved-search-weekly-additional" style="display: none;">
          <label for="saved-search-weekly-on-day" class="action-panel-label">
            Which day?
          </label>
          <select id="saved-search-weekly-on-day" class="no-border-panel-selector saved-search-weekly-on-day">
            <option value="Sunday">Sunday</option>
            <option value="Monday">Monday</option>
            <option value="Tuesday">Tuesday</option>
            <option value="Wednesday">Wednesday</option>
            <option value="Thursday">Thursday</option>
            <option value="Friday">Friday</option>
            <option value="Saturday">Saturday</option>
          </select>
        </div>
        <div class="action-panel-control-wrap">
          <label for="saved-search-report" class="action-panel-label">
            Report format:
          </label>
          <select id="saved-search-report" class="no-border-panel-selector saved-search-report">
            <option value="DocSum">Summary</option>
            <option value="DocSumText">Summary (text)</option>
            <option value="Abstract">Abstract</option>
            <option value="AbstractText">Abstract (text)</option>
            <option value="MEDLINE">PubMed</option>
          </select>
        </div>
        <div class="action-panel-control-wrap">
          <label for="saved-search-amount" class="action-panel-label">
            Send at most:
          </label>
          <select id="saved-search-amount" class="no-border-panel-selector saved-search-amount">
            <option value="1">1 item</option>
            <option value="5" selected="">5 items</option>
            <option value="10">10 items</option>
            <option value="20">20 items</option>
            <option value="50">50 items</option>
            <option value="100">100 items</option>
            <option value="200">200 items</option>
          </select>
        </div>
        <div>
          <input type="checkbox" id="saved-search-send-if-no-result" class="saved-search-send-if-no-result" name="saved-search-send-if-no-result">
          <label for="saved-search-send-if-no-result" class="action-panel-label smaller-checkbox">
            Send even when there aren't any new results
          </label>
        </div>
        <div class="action-panel-control-wrap option-text-in-email-wrap">
          <label for="saved-search-email-text" class="action-panel-label">
            Optional text in email:
          </label>
          <textarea name="saved-search-email-text" id="saved-search-email-text" class="saved-search-email-text"></textarea>
        </div>
        
          <input type="hidden" name="search-timestamp" class="search-timestamp" value="1768033296.032671">
        
      </div>

      <div class="action-panel-actions">
        <button class="action-panel-submit" type="submit" data-loading-label="Saving..." data-ga-category="save_share" data-ga-action="alert" data-ga-label="save">
          Save
        </button>
        <button class="action-panel-cancel" aria-label="Close 'Your saved search' panel" ref="linksrc=close_saved_search_panel" aria-controls="saved-search-action-panel" aria-expanded="false" data-ga-category="save_share" data-ga-action="alert" data-ga-label="cancel">
          Cancel
        </button>
      </div>
    </form>
  </div>
</div>

      


<div id="rss-action-panel" class="rss-action-panel action-panel " aria-hidden="true">
  <div class="inner-wrap">
    <h2 class="action-panel-heading">
      Your RSS Feed
    </h2>

    <form id="rss-action-panel-form" class="rss-action-panel-form action-panel-content action-form" data-create-rss-feed-url="/create-rss-feed-url/" data-search-form-term-value="(hypertension[Title]) AND (food[Text Word])">

      <input type="hidden" name="csrfmiddlewaretoken" value="sXcYXzaFLKFHRX0o0yUeKm8kYyZpxgiSZsGy4hvUQ650c0B9IvSjrwtOec8h6uM9">

      <div class="action-panel-control-wrap">
        <label for="rss-name" class="action-panel-label required-field-asterisk">
          Name of RSS Feed:
        </label>
        <input maxlength="200" placeholder="Name" type="text" name="rss-name" id="rss-name" class="rss-name" value="(hypertension[Title]) AND (food[Text Word])" required="" pattern="[^&quot;&amp;=&lt;&gt;\/]*" title="The following characters are not allowed in the Name field: &quot;&amp;=&lt;&gt;/">
      </div>

      <div class="rss-limit-wrap">
        <div class="action-panel-control-wrap action-panel-extra-margin-top">
          <label for="rss-limit" class="action-panel-label">
            Number of items displayed:
          </label>
          <select id="rss-limit" class="no-border-panel-selector rss-limit">
            <option value="5">5</option>
            <option value="10">10</option>
            <option value="15" selected="selected">15</option>
            <option value="20">20</option>
            <option value="50">50</option>
            <option value="100">100</option>
          </select>
        </div>
      </div>

      <div class="action-panel-actions">
        <button class="action-panel-submit" type="submit" data-loading-label="Creating..." data-ga-category="save_share" data-ga-action="alert" data-ga-label="save">
          Create RSS
        </button>
        <button class="action-panel-cancel" aria-label="Close 'Your RSS' panel" ref="linksrc=close_rss_panel" aria-controls="rss-action-panel" aria-expanded="false" data-ga-category="save_share" data-ga-action="alert" data-ga-label="cancel">
          Cancel
        </button>
      </div>

      <div class="action-panel-control-wrap rss-link-copy-wrap">
        <label for="rss-link" class="usa-sr-only">RSS Link</label>
        <input placeholder="Your RSS Feed Link" type="text" name="rss-link" id="rss-link" class="rss-link" title="RSS Link">
        <button type="button" disabled="" class="rss-link-copy-button disabled" data-ga-category="save_share" data-ga-action="rss" data-ga-label="copy">
          Copy
        </button>
      </div>
    </form>
  </div>
</div>

    

    <div class="inner-wrap">
      <div class="static-filters" id="static-filters">
  <h2 class="usa-sr-only">Filters</h2>
  


<div class="user-filters hide-on-mobile">
  <div class="user-filter-title">
    <h3 class="title">My Custom Filters</h3>
    <a class="manage-myncbi-link" title="Manage My Custom Filters" aria-label="Manage My Custom Filters" href="https://www.ncbi.nlm.nih.gov/sites/myncbi/pubmed/filters">
    </a>
  </div>
  
</div><div class="timeline-filter side-timeline-filter lots-of-bars" style="">

    <h3 class="title">
      Results by year
    </h3>

    <button class="toggle-button" title="Expand/collapse timeline">
      Expand/collapse timeline
    </button>

    <form id="side-export-search-by-year-form" class="export-search-by-year-form" action="/results-export-search-by-year/" method="post">
      <input type="hidden" name="csrfmiddlewaretoken" value="sXcYXzaFLKFHRX0o0yUeKm8kYyZpxgiSZsGy4hvUQ650c0B9IvSjrwtOec8h6uM9">
      <button type="submit" id="side-download-results-by-year-button" class="download-results-by-year-button" title="Download CSV">
      </button>
    </form>

    <button class="reset-button">
      Reset
    </button>

    <div class="inner-wrap">
      <div class="histogram">
        <svg xmlns="http://www.w3.org/2000/svg">
          <!-- Dynamic content -->
        <g class="bar-group selected" data-bar-index="0"><rect class="bar-bg" x="0%" y="0" width="1.25%" height="100%"></rect><rect class="bar" x="0%" y="97.3758389261745%" width="1.25%" height="2.624161073825503%"></rect></g><g class="bar-group selected" data-bar-index="1"><rect class="bar-bg" x="1.25%" y="0" width="1.25%" height="100%"></rect><rect class="bar" x="1.25%" y="98%" width="1.25%" height="2%"></rect></g><g class="bar-group selected" data-bar-index="2"><rect class="bar-bg" x="2.5%" y="0" width="1.25%" height="100%"></rect><rect class="bar" x="2.5%" y="98%" width="1.25%" height="2%"></rect></g><g class="bar-group selected" data-bar-index="3"><rect class="bar-bg" x="3.75%" y="0" width="1.25%" height="100%"></rect><rect class="bar" x="3.75%" y="98%" width="1.25%" height="2%"></rect></g><g class="bar-group selected" data-bar-index="4"><rect class="bar-bg" x="5%" y="0" width="1.25%" height="100%"></rect><rect class="bar" x="5%" y="97.3758389261745%" width="1.25%" height="2.624161073825503%"></rect></g><g class="bar-group selected" data-bar-index="5"><rect class="bar-bg" x="6.25%" y="0" width="1.25%" height="100%"></rect><rect class="bar" x="6.25%" y="97.3758389261745%" width="1.25%" height="2.624161073825503%"></rect></g><g class="bar-group selected" data-bar-index="6"><rect class="bar-bg" x="7.5%" y="0" width="1.25%" height="100%"></rect><rect class="bar" x="7.5%" y="98%" width="1.25%" height="2%"></rect></g><g class="bar-group selected" data-bar-index="7"><rect class="bar-bg" x="8.75%" y="0" width="1.25%" height="100%"></rect><rect class="bar" x="8.75%" y="96.75167785234899%" width="1.25%" height="3.248322147651007%"></rect></g><g class="bar-group selected" data-bar-index="8"><rect class="bar-bg" x="10%" y="0" width="1.25%" height="100%"></rect><rect class="bar" x="10%" y="98%" width="1.25%" height="2%"></rect></g><g class="bar-group selected" data-bar-index="9"><rect class="bar-bg" x="11.25%" y="0" width="1.25%" height="100%"></rect><rect class="bar" x="11.25%" y="98%" width="1.25%" height="2%"></rect></g><g class="bar-group selected" data-bar-index="10"><rect class="bar-bg" x="12.5%" y="0" width="1.25%" height="100%"></rect><rect class="bar" x="12.5%" y="98%" width="1.25%" height="2%"></rect></g><g class="bar-group selected" data-bar-index="11"><rect class="bar-bg" x="13.75%" y="0" width="1.25%" height="100%"></rect><rect class="bar" x="13.75%" y="97.3758389261745%" width="1.25%" height="2.624161073825503%"></rect></g><g class="bar-group selected" data-bar-index="12"><rect class="bar-bg" x="15%" y="0" width="1.25%" height="100%"></rect><rect class="bar" x="15%" y="97.3758389261745%" width="1.25%" height="2.624161073825503%"></rect></g><g class="bar-group selected" data-bar-index="13"><rect class="bar-bg" x="16.25%" y="0" width="1.25%" height="100%"></rect><rect class="bar" x="16.25%" y="98%" width="1.25%" height="2%"></rect></g><g class="bar-group selected" data-bar-index="14"><rect class="bar-bg" x="17.5%" y="0" width="1.25%" height="100%"></rect><rect class="bar" x="17.5%" y="98%" width="1.25%" height="2%"></rect></g><g class="bar-group selected" data-bar-index="15"><rect class="bar-bg" x="18.75%" y="0" width="1.25%" height="100%"></rect><rect class="bar" x="18.75%" y="97.3758389261745%" width="1.25%" height="2.624161073825503%"></rect></g><g class="bar-group selected" data-bar-index="16"><rect class="bar-bg" x="20%" y="0" width="1.25%" height="100%"></rect><rect class="bar" x="20%" y="98%" width="1.25%" height="2%"></rect></g><g class="bar-group selected" data-bar-index="17"><rect class="bar-bg" x="21.25%" y="0" width="1.25%" height="100%"></rect><rect class="bar" x="21.25%" y="97.3758389261745%" width="1.25%" height="2.624161073825503%"></rect></g><g class="bar-group selected" data-bar-index="18"><rect class="bar-bg" x="22.5%" y="0" width="1.25%" height="100%"></rect><rect class="bar" x="22.5%" y="98%" width="1.25%" height="2%"></rect></g><g class="bar-group selected" data-bar-index="19"><rect class="bar-bg" x="23.75%" y="0" width="1.25%" height="100%"></rect><rect class="bar" x="23.75%" y="98%" width="1.25%" height="2%"></rect></g><g class="bar-group selected" data-bar-index="20"><rect class="bar-bg" x="25%" y="0" width="1.25%" height="100%"></rect><rect class="bar" x="25%" y="96.75167785234899%" width="1.25%" height="3.248322147651007%"></rect></g><g class="bar-group selected" data-bar-index="21"><rect class="bar-bg" x="26.25%" y="0" width="1.25%" height="100%"></rect><rect class="bar" x="26.25%" y="97.3758389261745%" width="1.25%" height="2.624161073825503%"></rect></g><g class="bar-group selected" data-bar-index="22"><rect class="bar-bg" x="27.5%" y="0" width="1.25%" height="100%"></rect><rect class="bar" x="27.5%" y="97.3758389261745%" width="1.25%" height="2.624161073825503%"></rect></g><g class="bar-group selected" data-bar-index="23"><rect class="bar-bg" x="28.75%" y="0" width="1.25%" height="100%"></rect><rect class="bar" x="28.75%" y="96.75167785234899%" width="1.25%" height="3.248322147651007%"></rect></g><g class="bar-group selected" data-bar-index="24"><rect class="bar-bg" x="30%" y="0" width="1.25%" height="100%"></rect><rect class="bar" x="30%" y="98%" width="1.25%" height="2%"></rect></g><g class="bar-group selected" data-bar-index="25"><rect class="bar-bg" x="31.25%" y="0" width="1.25%" height="100%"></rect><rect class="bar" x="31.25%" y="98%" width="1.25%" height="2%"></rect></g><g class="bar-group selected" data-bar-index="26"><rect class="bar-bg" x="32.5%" y="0" width="1.25%" height="100%"></rect><rect class="bar" x="32.5%" y="97.3758389261745%" width="1.25%" height="2.624161073825503%"></rect></g><g class="bar-group selected" data-bar-index="27"><rect class="bar-bg" x="33.75%" y="0" width="1.25%" height="100%"></rect><rect class="bar" x="33.75%" y="95.50335570469798%" width="1.25%" height="4.496644295302013%"></rect></g><g class="bar-group selected" data-bar-index="28"><rect class="bar-bg" x="35%" y="0" width="1.25%" height="100%"></rect><rect class="bar" x="35%" y="95.50335570469798%" width="1.25%" height="4.496644295302013%"></rect></g><g class="bar-group selected" data-bar-index="29"><rect class="bar-bg" x="36.25%" y="0" width="1.25%" height="100%"></rect><rect class="bar" x="36.25%" y="96.75167785234899%" width="1.25%" height="3.248322147651007%"></rect></g><g class="bar-group selected" data-bar-index="30"><rect class="bar-bg" x="37.5%" y="0" width="1.25%" height="100%"></rect><rect class="bar" x="37.5%" y="95.50335570469798%" width="1.25%" height="4.496644295302013%"></rect></g><g class="bar-group selected" data-bar-index="31"><rect class="bar-bg" x="38.75%" y="0" width="1.25%" height="100%"></rect><rect class="bar" x="38.75%" y="96.12751677852349%" width="1.25%" height="3.8724832214765095%"></rect></g><g class="bar-group selected" data-bar-index="32"><rect class="bar-bg" x="40%" y="0" width="1.25%" height="100%"></rect><rect class="bar" x="40%" y="96.12751677852349%" width="1.25%" height="3.8724832214765095%"></rect></g><g class="bar-group selected" data-bar-index="33"><rect class="bar-bg" x="41.25%" y="0" width="1.25%" height="100%"></rect><rect class="bar" x="41.25%" y="93.63087248322148%" width="1.25%" height="6.369127516778524%"></rect></g><g class="bar-group selected" data-bar-index="34"><rect class="bar-bg" x="42.5%" y="0" width="1.25%" height="100%"></rect><rect class="bar" x="42.5%" y="97.3758389261745%" width="1.25%" height="2.624161073825503%"></rect></g><g class="bar-group selected" data-bar-index="35"><rect class="bar-bg" x="43.75%" y="0" width="1.25%" height="100%"></rect><rect class="bar" x="43.75%" y="91.13422818791946%" width="1.25%" height="8.865771812080538%"></rect></g><g class="bar-group selected" data-bar-index="36"><rect class="bar-bg" x="45%" y="0" width="1.25%" height="100%"></rect><rect class="bar" x="45%" y="92.38255033557047%" width="1.25%" height="7.617449664429531%"></rect></g><g class="bar-group selected" data-bar-index="37"><rect class="bar-bg" x="46.25%" y="0" width="1.25%" height="100%"></rect><rect class="bar" x="46.25%" y="90.51006711409396%" width="1.25%" height="9.48993288590604%"></rect></g><g class="bar-group selected" data-bar-index="38"><rect class="bar-bg" x="47.5%" y="0" width="1.25%" height="100%"></rect><rect class="bar" x="47.5%" y="88.63758389261746%" width="1.25%" height="11.362416107382549%"></rect></g><g class="bar-group selected" data-bar-index="39"><rect class="bar-bg" x="48.75%" y="0" width="1.25%" height="100%"></rect><rect class="bar" x="48.75%" y="92.38255033557047%" width="1.25%" height="7.617449664429531%"></rect></g><g class="bar-group selected" data-bar-index="40"><rect class="bar-bg" x="50%" y="0" width="1.25%" height="100%"></rect><rect class="bar" x="50%" y="93.63087248322148%" width="1.25%" height="6.369127516778524%"></rect></g><g class="bar-group selected" data-bar-index="41"><rect class="bar-bg" x="51.25%" y="0" width="1.25%" height="100%"></rect><rect class="bar" x="51.25%" y="93.63087248322148%" width="1.25%" height="6.369127516778524%"></rect></g><g class="bar-group selected" data-bar-index="42"><rect class="bar-bg" x="52.5%" y="0" width="1.25%" height="100%"></rect><rect class="bar" x="52.5%" y="92.38255033557047%" width="1.25%" height="7.617449664429531%"></rect></g><g class="bar-group selected" data-bar-index="43"><rect class="bar-bg" x="53.75%" y="0" width="1.25%" height="100%"></rect><rect class="bar" x="53.75%" y="88.01342281879195%" width="1.25%" height="11.986577181208053%"></rect></g><g class="bar-group selected" data-bar-index="44"><rect class="bar-bg" x="55%" y="0" width="1.25%" height="100%"></rect><rect class="bar" x="55%" y="88.01342281879195%" width="1.25%" height="11.986577181208053%"></rect></g><g class="bar-group selected" data-bar-index="45"><rect class="bar-bg" x="56.25%" y="0" width="1.25%" height="100%"></rect><rect class="bar" x="56.25%" y="91.13422818791946%" width="1.25%" height="8.865771812080538%"></rect></g><g class="bar-group selected" data-bar-index="46"><rect class="bar-bg" x="57.5%" y="0" width="1.25%" height="100%"></rect><rect class="bar" x="57.5%" y="90.51006711409396%" width="1.25%" height="9.48993288590604%"></rect></g><g class="bar-group selected" data-bar-index="47"><rect class="bar-bg" x="58.75%" y="0" width="1.25%" height="100%"></rect><rect class="bar" x="58.75%" y="91.75838926174497%" width="1.25%" height="8.241610738255032%"></rect></g><g class="bar-group selected" data-bar-index="48"><rect class="bar-bg" x="60%" y="0" width="1.25%" height="100%"></rect><rect class="bar" x="60%" y="85.51677852348993%" width="1.25%" height="14.483221476510067%"></rect></g><g class="bar-group selected" data-bar-index="49"><rect class="bar-bg" x="61.25%" y="0" width="1.25%" height="100%"></rect><rect class="bar" x="61.25%" y="86.76510067114094%" width="1.25%" height="13.23489932885906%"></rect></g><g class="bar-group selected" data-bar-index="50"><rect class="bar-bg" x="62.5%" y="0" width="1.25%" height="100%"></rect><rect class="bar" x="62.5%" y="84.89261744966443%" width="1.25%" height="15.107382550335569%"></rect></g><g class="bar-group selected" data-bar-index="51"><rect class="bar-bg" x="63.75%" y="0" width="1.25%" height="100%"></rect><rect class="bar" x="63.75%" y="89.88590604026845%" width="1.25%" height="10.114093959731543%"></rect></g><g class="bar-group selected" data-bar-index="52"><rect class="bar-bg" x="65%" y="0" width="1.25%" height="100%"></rect><rect class="bar" x="65%" y="82.39597315436242%" width="1.25%" height="17.604026845637584%"></rect></g><g class="bar-group selected" data-bar-index="53"><rect class="bar-bg" x="66.25%" y="0" width="1.25%" height="100%"></rect><rect class="bar" x="66.25%" y="86.14093959731544%" width="1.25%" height="13.859060402684564%"></rect></g><g class="bar-group selected" data-bar-index="54"><rect class="bar-bg" x="67.5%" y="0" width="1.25%" height="100%"></rect><rect class="bar" x="67.5%" y="88.63758389261746%" width="1.25%" height="11.362416107382549%"></rect></g><g class="bar-group selected" data-bar-index="55"><rect class="bar-bg" x="68.75%" y="0" width="1.25%" height="100%"></rect><rect class="bar" x="68.75%" y="86.76510067114094%" width="1.25%" height="13.23489932885906%"></rect></g><g class="bar-group selected" data-bar-index="56"><rect class="bar-bg" x="70%" y="0" width="1.25%" height="100%"></rect><rect class="bar" x="70%" y="90.51006711409396%" width="1.25%" height="9.48993288590604%"></rect></g><g class="bar-group selected" data-bar-index="57"><rect class="bar-bg" x="71.25%" y="0" width="1.25%" height="100%"></rect><rect class="bar" x="71.25%" y="83.02013422818791%" width="1.25%" height="16.97986577181208%"></rect></g><g class="bar-group selected" data-bar-index="58"><rect class="bar-bg" x="72.5%" y="0" width="1.25%" height="100%"></rect><rect class="bar" x="72.5%" y="79.2751677852349%" width="1.25%" height="20.724832214765097%"></rect></g><g class="bar-group selected" data-bar-index="59"><rect class="bar-bg" x="73.75%" y="0" width="1.25%" height="100%"></rect><rect class="bar" x="73.75%" y="78.02684563758389%" width="1.25%" height="21.973154362416107%"></rect></g><g class="bar-group selected" data-bar-index="60"><rect class="bar-bg" x="75%" y="0" width="1.25%" height="100%"></rect><rect class="bar" x="75%" y="70.53691275167785%" width="1.25%" height="29.46308724832215%"></rect></g><g class="bar-group selected" data-bar-index="61"><rect class="bar-bg" x="76.25%" y="0" width="1.25%" height="100%"></rect><rect class="bar" x="76.25%" y="70.53691275167785%" width="1.25%" height="29.46308724832215%"></rect></g><g class="bar-group selected" data-bar-index="62"><rect class="bar-bg" x="77.5%" y="0" width="1.25%" height="100%"></rect><rect class="bar" x="77.5%" y="73.03355704697987%" width="1.25%" height="26.96644295302013%"></rect></g><g class="bar-group selected" data-bar-index="63"><rect class="bar-bg" x="78.75%" y="0" width="1.25%" height="100%"></rect><rect class="bar" x="78.75%" y="67.41610738255034%" width="1.25%" height="32.58389261744966%"></rect></g><g class="bar-group selected" data-bar-index="64"><rect class="bar-bg" x="80%" y="0" width="1.25%" height="100%"></rect><rect class="bar" x="80%" y="73.65771812080537%" width="1.25%" height="26.34228187919463%"></rect></g><g class="bar-group selected" data-bar-index="65"><rect class="bar-bg" x="81.25%" y="0" width="1.25%" height="100%"></rect><rect class="bar" x="81.25%" y="63.671140939597315%" width="1.25%" height="36.328859060402685%"></rect></g><g class="bar-group selected" data-bar-index="66"><rect class="bar-bg" x="82.5%" y="0" width="1.25%" height="100%"></rect><rect class="bar" x="82.5%" y="59.92617449664429%" width="1.25%" height="40.07382550335571%"></rect></g><g class="bar-group selected" data-bar-index="67"><rect class="bar-bg" x="83.75%" y="0" width="1.25%" height="100%"></rect><rect class="bar" x="83.75%" y="49.31543624161074%" width="1.25%" height="50.68456375838926%"></rect></g><g class="bar-group selected" data-bar-index="68"><rect class="bar-bg" x="85%" y="0" width="1.25%" height="100%"></rect><rect class="bar" x="85%" y="51.18791946308725%" width="1.25%" height="48.81208053691275%"></rect></g><g class="bar-group selected" data-bar-index="69"><rect class="bar-bg" x="86.25%" y="0" width="1.25%" height="100%"></rect><rect class="bar" x="86.25%" y="53.68456375838927%" width="1.25%" height="46.31543624161073%"></rect></g><g class="bar-group selected" data-bar-index="70"><rect class="bar-bg" x="87.5%" y="0" width="1.25%" height="100%"></rect><rect class="bar" x="87.5%" y="43.0738255033557%" width="1.25%" height="56.9261744966443%"></rect></g><g class="bar-group selected" data-bar-index="71"><rect class="bar-bg" x="88.75%" y="0" width="1.25%" height="100%"></rect><rect class="bar" x="88.75%" y="40.577181208053695%" width="1.25%" height="59.422818791946305%"></rect></g><g class="bar-group selected" data-bar-index="72"><rect class="bar-bg" x="90%" y="0" width="1.25%" height="100%"></rect><rect class="bar" x="90%" y="50.56375838926174%" width="1.25%" height="49.43624161073826%"></rect></g><g class="bar-group selected" data-bar-index="73"><rect class="bar-bg" x="91.25%" y="0" width="1.25%" height="100%"></rect><rect class="bar" x="91.25%" y="30.590604026845654%" width="1.25%" height="69.40939597315435%"></rect></g><g class="bar-group selected" data-bar-index="74"><rect class="bar-bg" x="92.5%" y="0" width="1.25%" height="100%"></rect><rect class="bar" x="92.5%" y="24.34899328859062%" width="1.25%" height="75.65100671140938%"></rect></g><g class="bar-group selected" data-bar-index="75"><rect class="bar-bg" x="93.75%" y="0" width="1.25%" height="100%"></rect><rect class="bar" x="93.75%" y="17.483221476510067%" width="1.25%" height="82.51677852348993%"></rect></g><g class="bar-group selected" data-bar-index="76"><rect class="bar-bg" x="95%" y="0" width="1.25%" height="100%"></rect><rect class="bar" x="95%" y="16.234899328859058%" width="1.25%" height="83.76510067114094%"></rect></g><g class="bar-group selected" data-bar-index="77"><rect class="bar-bg" x="96.25%" y="0" width="1.25%" height="100%"></rect><rect class="bar" x="96.25%" y="5%" width="1.25%" height="95%"></rect></g><g class="bar-group selected" data-bar-index="78"><rect class="bar-bg" x="97.5%" y="0" width="1.25%" height="100%"></rect><rect class="bar" x="97.5%" y="9.993288590604038%" width="1.25%" height="90.00671140939596%"></rect></g><g class="bar-group selected" data-bar-index="79"><rect class="bar-bg" x="98.75%" y="0" width="1.25%" height="100%"></rect><rect class="bar" x="98.75%" y="94.25503355704699%" width="1.25%" height="5.74496644295302%"></rect></g></svg>

        <div class="hint">
          <span class="year"></span>
          <span class="count"></span>
        </div>
      </div>
      <div class="slider">
        <!-- Dynamic content -->
      <div class="noUi-target noUi-ltr noUi-horizontal noUi-txt-dir-ltr" style="width: 98.75%;"><div class="noUi-base"><div class="noUi-connects"><div class="noUi-connect noUi-draggable" style="transform: translate(0%, 0px) scale(1, 1);"></div></div><div class="noUi-origin" style="transform: translate(-100%, 0px); z-index: 5;"><div class="noUi-handle noUi-handle-lower" data-handle="0" tabindex="0" role="slider" aria-orientation="horizontal" aria-valuemin="1947.0" aria-valuemax="2026.0" aria-valuenow="1947.0" aria-valuetext="1947.00" aria-label="Lower handle"><div class="noUi-touch-area"></div><div class="noUi-tooltip">1947</div></div></div><div class="noUi-origin" style="transform: translate(0%, 0px); z-index: 4;"><div class="noUi-handle noUi-handle-upper" data-handle="1" tabindex="0" role="slider" aria-orientation="horizontal" aria-valuemin="1947.0" aria-valuemax="2026.0" aria-valuenow="2026.0" aria-valuetext="2026.00" aria-label="Upper handle"><div class="noUi-touch-area"></div><div class="noUi-tooltip">2026</div></div></div></div></div></div>
    </div>
    
      <p id="table-description" class="usa-sr-only">Table representation of search results timeline featuring number of search results per year.</p>
<table id="timeline-table" class="usa-sr-only table-sr-only" aria-label="Table of search results timeline data" aria-describedby="table-description" aria-rowcount="66">
  <thead>
    <tr>
      <th scope="col">Year</th>
      <th scope="col">Number of Results</th>
    </tr>
  </thead>
  <tbody>
    
      <tr>
        <td> 1947 </td>
        <td> 1 </td>
      </tr>
    
      <tr>
        <td> 1951 </td>
        <td> 1 </td>
      </tr>
    
      <tr>
        <td> 1952 </td>
        <td> 1 </td>
      </tr>
    
      <tr>
        <td> 1954 </td>
        <td> 2 </td>
      </tr>
    
      <tr>
        <td> 1958 </td>
        <td> 1 </td>
      </tr>
    
      <tr>
        <td> 1959 </td>
        <td> 1 </td>
      </tr>
    
      <tr>
        <td> 1962 </td>
        <td> 1 </td>
      </tr>
    
      <tr>
        <td> 1964 </td>
        <td> 1 </td>
      </tr>
    
      <tr>
        <td> 1967 </td>
        <td> 2 </td>
      </tr>
    
      <tr>
        <td> 1968 </td>
        <td> 1 </td>
      </tr>
    
      <tr>
        <td> 1969 </td>
        <td> 1 </td>
      </tr>
    
      <tr>
        <td> 1970 </td>
        <td> 2 </td>
      </tr>
    
      <tr>
        <td> 1973 </td>
        <td> 1 </td>
      </tr>
    
      <tr>
        <td> 1974 </td>
        <td> 4 </td>
      </tr>
    
      <tr>
        <td> 1975 </td>
        <td> 4 </td>
      </tr>
    
      <tr>
        <td> 1976 </td>
        <td> 2 </td>
      </tr>
    
      <tr>
        <td> 1977 </td>
        <td> 4 </td>
      </tr>
    
      <tr>
        <td> 1978 </td>
        <td> 3 </td>
      </tr>
    
      <tr>
        <td> 1979 </td>
        <td> 3 </td>
      </tr>
    
      <tr>
        <td> 1980 </td>
        <td> 7 </td>
      </tr>
    
      <tr>
        <td> 1981 </td>
        <td> 1 </td>
      </tr>
    
      <tr>
        <td> 1982 </td>
        <td> 11 </td>
      </tr>
    
      <tr>
        <td> 1983 </td>
        <td> 9 </td>
      </tr>
    
      <tr>
        <td> 1984 </td>
        <td> 12 </td>
      </tr>
    
      <tr>
        <td> 1985 </td>
        <td> 15 </td>
      </tr>
    
      <tr>
        <td> 1986 </td>
        <td> 9 </td>
      </tr>
    
      <tr>
        <td> 1987 </td>
        <td> 7 </td>
      </tr>
    
      <tr>
        <td> 1988 </td>
        <td> 7 </td>
      </tr>
    
      <tr>
        <td> 1989 </td>
        <td> 9 </td>
      </tr>
    
      <tr>
        <td> 1990 </td>
        <td> 16 </td>
      </tr>
    
      <tr>
        <td> 1991 </td>
        <td> 16 </td>
      </tr>
    
      <tr>
        <td> 1992 </td>
        <td> 11 </td>
      </tr>
    
      <tr>
        <td> 1993 </td>
        <td> 12 </td>
      </tr>
    
      <tr>
        <td> 1994 </td>
        <td> 10 </td>
      </tr>
    
      <tr>
        <td> 1995 </td>
        <td> 20 </td>
      </tr>
    
      <tr>
        <td> 1996 </td>
        <td> 18 </td>
      </tr>
    
      <tr>
        <td> 1997 </td>
        <td> 21 </td>
      </tr>
    
      <tr>
        <td> 1998 </td>
        <td> 13 </td>
      </tr>
    
      <tr>
        <td> 1999 </td>
        <td> 25 </td>
      </tr>
    
      <tr>
        <td> 2000 </td>
        <td> 19 </td>
      </tr>
    
      <tr>
        <td> 2001 </td>
        <td> 15 </td>
      </tr>
    
      <tr>
        <td> 2002 </td>
        <td> 18 </td>
      </tr>
    
      <tr>
        <td> 2003 </td>
        <td> 12 </td>
      </tr>
    
      <tr>
        <td> 2004 </td>
        <td> 24 </td>
      </tr>
    
      <tr>
        <td> 2005 </td>
        <td> 30 </td>
      </tr>
    
      <tr>
        <td> 2006 </td>
        <td> 32 </td>
      </tr>
    
      <tr>
        <td> 2007 </td>
        <td> 44 </td>
      </tr>
    
      <tr>
        <td> 2008 </td>
        <td> 44 </td>
      </tr>
    
      <tr>
        <td> 2009 </td>
        <td> 40 </td>
      </tr>
    
      <tr>
        <td> 2010 </td>
        <td> 49 </td>
      </tr>
    
      <tr>
        <td> 2011 </td>
        <td> 39 </td>
      </tr>
    
      <tr>
        <td> 2012 </td>
        <td> 55 </td>
      </tr>
    
      <tr>
        <td> 2013 </td>
        <td> 61 </td>
      </tr>
    
      <tr>
        <td> 2014 </td>
        <td> 78 </td>
      </tr>
    
      <tr>
        <td> 2015 </td>
        <td> 75 </td>
      </tr>
    
      <tr>
        <td> 2016 </td>
        <td> 71 </td>
      </tr>
    
      <tr>
        <td> 2017 </td>
        <td> 88 </td>
      </tr>
    
      <tr>
        <td> 2018 </td>
        <td> 92 </td>
      </tr>
    
      <tr>
        <td> 2019 </td>
        <td> 76 </td>
      </tr>
    
      <tr>
        <td> 2020 </td>
        <td> 108 </td>
      </tr>
    
      <tr>
        <td> 2021 </td>
        <td> 118 </td>
      </tr>
    
      <tr>
        <td> 2022 </td>
        <td> 129 </td>
      </tr>
    
      <tr>
        <td> 2023 </td>
        <td> 131 </td>
      </tr>
    
      <tr>
        <td> 2024 </td>
        <td> 149 </td>
      </tr>
    
      <tr>
        <td> 2025 </td>
        <td> 141 </td>
      </tr>
    
      <tr>
        <td> 2026 </td>
        <td> 6 </td>
      </tr>
    
  </tbody>
</table>

    
  </div>

  
  



  
  <form id="static-filters-form" action=".">
    

<div class="form-field 
   filters-field
">

  

  

  <div class="choice-group-wrapper" role="group" aria-label="Filters"><div class="choice-group articleattr easyScholar-choice-grouop"><strong class="title" style="font-variant:normal; text-transform:none;" title="1：Q1, Q2, Q3, Q4使用的是Clarivate分区中SCI, SSCI分区。2: 1、2、3、4区使用的是中科院升级版, 基础版数据。3：8个单选框全部选中，或全部取消，代表不作任何改变（不存在于这8个等级中的期刊也会显示）。4：如果小于8个单选框，则代表只显示选中的等级，之间是或的关系，例如等级的为Q1或Q2或Q3或2区，则显示。5：影响因子使用的是SCIIF，SCIIF(5)。6: 影响因子与分区之间默认是or的关系，例如Q1或Q2或Q3或(IF 1-3)，则显示。7：可以调整第7点中or或者and的关系。---------------分隔符---------------逻辑1：若8个分区全部选中或全未选中，且，影响因子为空，则全部显示。逻辑2：若8个分区全部选中或全未选中，且，影响因子不为空，则只按照影响因子筛选。逻辑3：若8个分区部分选中，且，影响因子为空，则只按分区筛选。逻辑4：若8个分区部分选中，且，影响因子不为空，则按分区与影响因子筛选。">easyScholar显示设置<svg t="1670330865637" classname="icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="1253" width="16" height="16"> <path d="M512 992C246.912 992 32 777.088 32 512 32 246.912 246.912 32 512 32c265.088 0 480 214.912 480 480 0 265.088-214.912 480-480 480z m0-64c229.76 0 416-186.24 416-416S741.76 96 512 96 96 282.24 96 512s186.24 416 416 416z" p-id="1254"></path><path d="M552 601.696v22.432h-80v-22.432c0-51.296 24.192-99.808 58.816-136.704 26.464-28.224 25.728-27.424 33.28-36.384 19.968-23.776 27.904-40.768 27.904-60.608a80 80 0 1 0-160 0H352a160 160 0 0 1 320 0c0 41.664-15.68 75.2-46.656 112.064-5.216 6.208-10.88 12.576-17.856 20.096-2.688 2.88-5.44 5.888-9.152 9.792l-9.152 9.76c-21.952 23.36-37.184 53.92-37.184 81.984zM545.856 717.984c9.44 9.312 14.144 20.672 14.144 34.016 0 13.6-4.704 24.992-14.144 34.208A46.784 46.784 0 0 1 512 800c-13.12 0-24.448-4.608-33.856-13.792A45.856 45.856 0 0 1 464 752c0-13.344 4.704-24.704 14.144-34.016A46.464 46.464 0 0 1 512 704c13.12 0 24.448 4.672 33.856 13.984z" p-id="1255"></path></svg></strong><label style="padding-left:0px;">分区：</label><ul class="items" id="easyScholar_JCR" style="display: flex; font-size:1.0rem">
		<li> <input class="quartileBox" type="checkbox" id="easyScholar_JCR_q1" value="Q1" checked=""> <label for="easyScholar_JCR_q1" style="padding-left: 2rem; padding-right: 1rem"> Q1 </label> </li>
		<li> <input class="quartileBox" type="checkbox" id="easyScholar_JCR_q2" value="Q2" checked=""> <label for="easyScholar_JCR_q2" style="padding-left: 2rem; padding-right: 1rem"> Q2 &nbsp;</label> </li>
		<li> <input class="quartileBox" type="checkbox" id="easyScholar_JCR_q3" value="Q3" checked=""> <label for="easyScholar_JCR_q3" style="padding-left: 2rem; padding-right: 1rem"> Q3 &nbsp;</label> </li>
		<li> <input class="quartileBox" type="checkbox" id="easyScholar_JCR_q4" value="Q4" checked=""> <label for="easyScholar_JCR_q4" style="padding-left: 2rem; padding-right: 1rem"> Q4 &nbsp;</label> </li>
		</ul><ul class="items" id="easyScholar_zhongUp" style="display: flex; font-size:1.0rem">
		<li> <input class="quartileBox" type="checkbox" id="easyScholar_zhongUp_1" value="1区" checked=""> <label for="easyScholar_zhongUp_1" style="padding-left: 2rem; padding-right: 1rem">1区</label> </li>
		<li> <input class="quartileBox" type="checkbox" id="easyScholar_zhongUp_2" value="2区" checked=""> <label for="easyScholar_zhongUp_2" style="padding-left: 2rem; padding-right: 1rem">2区</label> </li>
		<li> <input class="quartileBox" type="checkbox" id="easyScholar_zhongUp_3" value="3区" checked=""> <label for="easyScholar_zhongUp_3" style="padding-left: 2rem; padding-right: 1rem">3区</label> </li>
		<li> <input class="quartileBox" type="checkbox" id="easyScholar_zhongUp_4" value="4区" checked=""> <label for="easyScholar_zhongUp_4" style="padding-left: 2rem; padding-right: 1rem">4区</label> </li>
		</ul><div>
            <label style="padding-left:0px;">影响因子范围：
              <input id="easyScholar_IF_MIN_MAX" placeholder="需按此格式填写：min-max">
            </label>
            
          </div><div><label style="padding-left:0px;">分区与影响因子的显示关系：</label><input type="checkbox" id="easyScholar-rank-if-relation" checked="checked"><label for="easyScholar-rank-if-relation" style="margin-top:10px">
        选中为or，不选为and 
      </label></div><input type="checkbox" id="easyScholar-hide-title" checked="checked"><label for="easyScholar-hide-title" style="margin-top:30px">
        显示期刊全称 
      </label></div>
    
      
        

<div class="choice-group datesearch">
  <h3 class="title">
    Publication date
    
  </h3>
  <ul class="items">
    
      
        
          
            <li>
              <input aria-checked="false" type="radio" name="filter" id="id_filter_datesearch.y_1" value="datesearch.y_1" data-is-custom="false">
              
                <label for="id_filter_datesearch.y_1">
                  1 year
                </label>
              
            </li>
          
        
      
    
      
        
          
            <li>
              <input aria-checked="false" type="radio" name="filter" id="id_filter_datesearch.y_5" value="datesearch.y_5" data-is-custom="false">
              
                <label for="id_filter_datesearch.y_5">
                  5 years
                </label>
              
            </li>
          
        
      
    
      
        
          
            <li>
              <input aria-checked="false" type="radio" name="filter" id="id_filter_datesearch.y_10" value="datesearch.y_10" data-is-custom="false">
              
                <label for="id_filter_datesearch.y_10">
                  10 years
                </label>
              
            </li>
          
        
      
    
      
        
          
            <li class="dropdown-block">
              <input aria-checked="false" type="radio" name="filter" id="id_filter_datesearch.y_custom" value="" data-is-custom="false">
              
                <label id="datepicker-trigger" for="id_filter_datesearch.y_custom" class="datepicker-trigger trigger" ref="linksrc=custom_range_datepicker_btn" title="Custom Range" tabindex="0" aria-label="Select to open a dropdown and enter a custom date range." data-pinger-ignore="" aria-expanded="false">
                  
                    Custom Range
                  
                </label>
                <div id="datepicker" class="datepicker-dropdown dropdown dropdown-container" aria-label="Date Picker" aria-hidden="true">
  <div class="title start-date">Start Date</div>
  <div class="content">
    <input class="start-year" aria-label="Start Year" name="start-year" type="number" max="3000" min="1000" placeholder="YYYY" value="">
    <input class="start-month" aria-label="Start Month" name="start-month" type="number" min="1" max="12" placeholder="MM" value="">
    <input class="start-day" aria-label="Start Day" name="start-day" type="number" min="1" max="31" placeholder="DD" value="">
  </div>
  <div class="title end-date">End Date</div>
  <div class="content">
    <input class="end-year" aria-label="End Year" name="end-year" type="number" max="3000" min="1000" placeholder="YYYY" value="">
    <input class="end-month" aria-label="End Month" name="end-month" type="number" min="1" max="12" placeholder="MM" value="">
    <input class="end-day" aria-label="End Day" name="end-day" type="number" min="1" max="31" placeholder="DD" value="">
  </div>
  <div class="actions-bar">
    <button class="clear-btn" data-ga-category="filter" data-ga-action="custom_datepicker" data-ga-label="clear">Clear</button>
    <button type="submit" class="apply-btn" data-pinger-ignore="">Apply</button>
  </div>
</div>

              
            </li>
          
        
      
    
  </ul>

  
</div>
      
    
      
        

<div class="choice-group ">
  <h3 class="title">
    Text availability
    
  </h3>
  <ul class="items">
    
      
        
          
            <li>
              <input aria-checked="false" type="checkbox" name="filter" id="id_filter_simsearch1.fha" value="simsearch1.fha" data-is-custom="false">
              
                <label for="id_filter_simsearch1.fha">
                  Abstract
                </label>
              
            </li>
          
        
      
    
      
        
          
            <li>
              <input aria-checked="false" type="checkbox" name="filter" id="id_filter_simsearch2.ffrft" value="simsearch2.ffrft" data-is-custom="false">
              
                <label for="id_filter_simsearch2.ffrft">
                  Free full text
                </label>
              
            </li>
          
        
      
    
      
        
          
            <li>
              <input aria-checked="false" type="checkbox" name="filter" id="id_filter_simsearch3.fft" value="simsearch3.fft" data-is-custom="false">
              
                <label for="id_filter_simsearch3.fft">
                  Full text
                </label>
              
            </li>
          
        
      
    
  </ul>

  
</div>
      
    
      
        

<div class="choice-group articleattr">
  <h3 class="title">
    Article attribute
    
  </h3>
  <ul class="items">
    
      
        
          
            <li>
              <input aria-checked="false" type="checkbox" name="filter" id="id_filter_articleattr.data" value="articleattr.data" data-is-custom="false">
              
                <label for="id_filter_articleattr.data">
                  Associated data
                </label>
              
            </li>
          
        
      
    
  </ul>

  
</div>
      
    
      
        

<div class="choice-group pubt">
  <h3 class="title">
    Article type
    
  </h3>
  <ul class="items">
    
      
    
      
    
      
    
      
    
      
    
      
        
          
            <li>
              <input aria-checked="false" type="checkbox" name="filter" id="id_filter_pubt.booksdocs" value="pubt.booksdocs" data-is-custom="false">
              
                <label for="id_filter_pubt.booksdocs">
                  Books and Documents
                </label>
              
            </li>
          
        
      
    
      
    
      
    
      
    
      
    
      
        
          
            <li>
              <input aria-checked="false" type="checkbox" name="filter" id="id_filter_pubt.clinicaltrial" value="pubt.clinicaltrial" data-is-custom="false">
              
                <label for="id_filter_pubt.clinicaltrial">
                  Clinical Trial
                </label>
              
            </li>
          
        
      
    
      
    
      
    
      
    
      
    
      
    
      
    
      
    
      
    
      
    
      
    
      
    
      
    
      
    
      
    
      
    
      
    
      
    
      
    
      
    
      
    
      
    
      
    
      
    
      
    
      
    
      
    
      
    
      
    
      
    
      
    
      
    
      
    
      
    
      
    
      
    
      
        
          
            <li>
              <input aria-checked="false" type="checkbox" name="filter" id="id_filter_pubt.meta-analysis" value="pubt.meta-analysis" data-is-custom="false">
              
                <label for="id_filter_pubt.meta-analysis">
                  Meta-Analysis
                </label>
              
            </li>
          
        
      
    
      
    
      
    
      
    
      
    
      
    
      
    
      
    
      
    
      
    
      
    
      
    
      
    
      
    
      
    
      
    
      
        
          
            <li>
              <input aria-checked="false" type="checkbox" name="filter" id="id_filter_pubt.randomizedcontrolledtrial" value="pubt.randomizedcontrolledtrial" data-is-custom="false">
              
                <label for="id_filter_pubt.randomizedcontrolledtrial">
                  Randomized Controlled Trial
                </label>
              
            </li>
          
        
      
    
      
    
      
    
      
    
      
    
      
    
      
    
      
    
      
    
      
    
      
    
      
        
          
            <li>
              <input aria-checked="false" type="checkbox" name="filter" id="id_filter_pubt.review" value="pubt.review" data-is-custom="false">
              
                <label for="id_filter_pubt.review">
                  Review
                </label>
              
            </li>
          
        
      
    
      
    
      
    
      
        
          
            <li>
              <input aria-checked="false" type="checkbox" name="filter" id="id_filter_pubt.systematicreview" value="pubt.systematicreview" data-is-custom="false">
              
                <label for="id_filter_pubt.systematicreview">
                  Systematic Review
                </label>
              
            </li>
          
        
      
    
      
    
      
    
      
    
      
    
      
    
  </ul>

  
    <button class="see-all-group-filters see-all-pubt" type="button" data-ga-category="filter" data-ga-action="see_all_link" data-ga-label="article_type">See all article type filters</button>
  
</div>
      
    
      
    
      
    
      
    
      
    
      
    
  </div>

  <div class="usa-accordion additional-filters">
    <h2 class="usa-sr-only">Additional filters</h2>
    <button class="usa-accordion-button additional-filters-button" aria-expanded="false" aria-controls="additional_filters" data-ga-category="filter" data-ga-action="additional_filters" data-ga-label="open">
      Additional filters
      <span class="additional-filters-count" style="display: none;"></span>
    </button>
    <div id="additional_filters" class="usa-accordion-content choice-group-wrapper" role="group" aria-label="Additional filters" style="display: none;" aria-hidden="true">
      
        
      
        
      
        
      
        
      
        
          

<div class="choice-group lang">
  <h3 class="title">
    Article Language
    
      <a href="/help/#filters-language" data-ga-category="filter" data-ga-action="info_icon" data-ga-label="filter_language" title="Learn about language filters" aria-label="Learn about language filters" class="filters-help-link"></a>
    
  </h3>
  <ul class="items">
    
      
    
      
    
      
    
      
    
      
    
      
    
      
    
      
    
      
    
      
    
      
    
      
    
      
    
      
        
          
            <li>
              <input aria-checked="false" type="checkbox" name="filter" id="id_filter_lang.english" value="lang.english" data-is-custom="false">
              
                <label for="id_filter_lang.english">
                  English
                </label>
              
            </li>
          
        
      
    
      
    
      
    
      
    
      
    
      
    
      
    
      
    
      
    
      
    
      
    
      
    
      
    
      
    
      
    
      
    
      
    
      
    
      
    
      
    
      
    
      
    
      
    
      
    
      
    
      
    
      
    
      
    
      
    
      
    
      
    
      
    
      
    
      
    
      
    
      
    
      
    
      
        
          
            <li>
              <input aria-checked="false" type="checkbox" name="filter" id="id_filter_lang.spanish" value="lang.spanish" data-is-custom="false">
              
                <label for="id_filter_lang.spanish">
                  Spanish
                </label>
              
            </li>
          
        
      
    
      
    
      
    
      
    
      
    
      
    
      
    
      
    
  </ul>

  
    <button class="see-all-group-filters see-all-lang" type="button" data-ga-category="filter" data-ga-action="see_all_link" data-ga-label="article_language">See all article language filters</button>
  
</div>
        
      
        
          

<div class="choice-group hum_ani">
  <h3 class="title">
    Species
    
      <a href="/help/#filters-species" data-ga-category="filter" data-ga-action="info_icon" data-ga-label="filter_species" title="Learn about species filters" aria-label="Learn about species filters" class="filters-help-link"></a>
    
  </h3>
  <ul class="items">
    
      
        
          
            <li>
              <input aria-checked="false" type="checkbox" name="filter" id="id_filter_hum_ani.humans" value="hum_ani.humans" data-is-custom="false">
              
                <label for="id_filter_hum_ani.humans">
                  Humans
                </label>
              
            </li>
          
        
      
    
      
        
          
            <li>
              <input aria-checked="false" type="checkbox" name="filter" id="id_filter_hum_ani.animal" value="hum_ani.animal" data-is-custom="false">
              
                <label for="id_filter_hum_ani.animal">
                  Other Animals
                </label>
              
            </li>
          
        
      
    
  </ul>

  
</div>
        
      
        
          

<div class="choice-group sex">
  <h3 class="title">
    Sex
    
      <a href="/help/#filters-sex" data-ga-category="filter" data-ga-action="info_icon" data-ga-label="filter_sex" title="Learn about sex filters" aria-label="Learn about sex filters" class="filters-help-link"></a>
    
  </h3>
  <ul class="items">
    
      
        
          
            <li>
              <input aria-checked="false" type="checkbox" name="filter" id="id_filter_sex.female" value="sex.female" data-is-custom="false">
              
                <label for="id_filter_sex.female">
                  Female
                </label>
              
            </li>
          
        
      
    
      
        
          
            <li>
              <input aria-checked="false" type="checkbox" name="filter" id="id_filter_sex.male" value="sex.male" data-is-custom="false">
              
                <label for="id_filter_sex.male">
                  Male
                </label>
              
            </li>
          
        
      
    
  </ul>

  
</div>
        
      
        
          

<div class="choice-group age">
  <h3 class="title">
    Age
    
      <a href="/help/#filters-age" data-ga-category="filter" data-ga-action="info_icon" data-ga-label="filter_age" title="Learn about age filters" aria-label="Learn about age filters" class="filters-help-link"></a>
    
  </h3>
  <ul class="items">
    
      
        
          
            <li>
              <input aria-checked="false" type="checkbox" name="filter" id="id_filter_age.allchild" value="age.allchild" data-is-custom="false">
              
                <label for="id_filter_age.allchild">
                  Child: birth-18 years
                </label>
              
            </li>
          
        
      
    
      
    
      
    
      
    
      
    
      
    
      
    
      
        
          
            <li>
              <input aria-checked="false" type="checkbox" name="filter" id="id_filter_age.alladult" value="age.alladult" data-is-custom="false">
              
                <label for="id_filter_age.alladult">
                  Adult: 19+ years
                </label>
              
            </li>
          
        
      
    
      
    
      
    
      
    
      
    
      
        
          
            <li>
              <input aria-checked="false" type="checkbox" name="filter" id="id_filter_age.aged" value="age.aged" data-is-custom="false">
              
                <label for="id_filter_age.aged">
                  Aged: 65+ years
                </label>
              
            </li>
          
        
      
    
      
    
  </ul>

  
    <button class="see-all-group-filters see-all-age" type="button" data-ga-category="filter" data-ga-action="see_all_link" data-ga-label="age">See all age filters</button>
  
</div>
        
      
        
          

<div class="choice-group other">
  <h3 class="title">
    Other
    
      <a href="/help/#filters-other" data-ga-category="filter" data-ga-action="info_icon" data-ga-label="filter_other" title="Learn about other filters" aria-label="Learn about other filters" class="filters-help-link"></a>
    
  </h3>
  <ul class="items">
    
      
        
          
            <li>
              <input aria-checked="false" type="checkbox" name="filter" id="id_filter_other.excludepreprints" value="other.excludepreprints" data-is-custom="false">
              
                <label for="id_filter_other.excludepreprints">
                  Exclude preprints
                </label>
              
            </li>
          
        
      
    
      
        
          
            <li>
              <input aria-checked="false" type="checkbox" name="filter" id="id_filter_other.medline" value="other.medline" data-is-custom="false">
              
                <label for="id_filter_other.medline">
                  MEDLINE
                </label>
              
            </li>
          
        
      
    
  </ul>

  
</div>
        
      
    </div>
  </div>

  <div class="actions-bar">
    <button class="clear-filters-btn usa-button-outline" data-ga-category="filter" data-ga-action="remove_filter" data-ga-label="clear_button" type="button">Clear applied filters</button>
    <button class="reset-btn usa-button-outline" data-ga-category="filter" data-ga-action="reset_filter" data-ga-label="reset_button" type="button">Reset filters menu</button>
  </div>


  
    
  
</div>

  </form>
</div>

      
        <h2 class="usa-sr-only">Search Results</h2>
      
      <div class="search-results" id="search-results" style="outline: none;">
  
    <div class="mobile-top-actions-bar" id="mobile-top-actions-bar">
  <div class="mobile-results-selector-wrap">
    <input class="mobile-this-page-selector" type="checkbox" name="mobile-this-page-selector" id="mobile-this-page-selector" aria-label="Select all results on this page">
    <label class="mobile-this-page-checkbox" for="mobile-this-page-selector">
    </label>
  </div>
  <div class="selected-results-amount" title="" aria-live="off"></div>
  <button class="clear-selection-button" aria-label="clear selection" data-ga-category="clear_selection" style="display: none;">
    
    clear all
  </button>
  <button class="more-actions-dialog-trigger trigger" title="Open dialog with more actions to take" ref="linksrc=more_actions_btn" aria-controls="more-actions-dropdown"></button>
</div>

  
  
  <div class="top-wrapper">
    <div class="results-amount-container not-first-page">
      

<div class="results-amount">
  
    <h3>
      
        <span class="value">1,827</span>
        results
      
    </h3>
  
</div>
      <div class="selected-results-container" id="results-container-selected-results-container">
  
    <div class="multiple-results-actions " role="region" aria-label="save, email, send to">
  <button id="results-container-save-results-panel-trigger" type="button" class="save-results save-results-panel-trigger" aria-expanded="false" aria-controls="save-action-panel" data-ga-category="save_share" data-ga-action="save" data-ga-label="open">
      Save
    </button><button id="results-container-email-results-panel-trigger" type="button" class="email-results email-results-login" aria-expanded="false" aria-controls="email-action-panel" data-login-url="https://account.ncbi.nlm.nih.gov/?back_url=https%3A%2F%2Fpubmed.ncbi.nlm.nih.gov%2F%3Fterm%3D%28hypertension%255BTitle%255D%29%2520AND%2520%28food%255BText%2520Word%255D%29%2520%26page%3D2%23open-email-panel" data-ga-category="save_share" data-ga-action="email" data-ga-label="open">
      Email
    </button><div class="more-actions dropdown-block"><button id="results-container-more-actions-trigger" type="button" class="trigger more-actions-trigger" ref="linksrc=show_moreactions_btn" aria-label="Send to" aria-controls="results-container-more-actions-dropdown">Send to</button><div id="results-container-more-actions-dropdown" class="dropdown dropdown-container" hidden=""><div class="content"><ul class="more-actions-links"><li><a class="clipboard-panel-trigger dropdown-block-link " href="#" role="button" data-ga-category="save_share" data-ga-action="clipboard" data-ga-label="send">
                  Clipboard
                </a></li><li><a role="button" class="dropdown-block-link bibliography-trigger-target" href="https://account.ncbi.nlm.nih.gov/?back_url=https%3A%2F%2Fpubmed.ncbi.nlm.nih.gov%2F%3Fterm%3D%28hypertension%255BTitle%255D%29%2520AND%2520%28food%255BText%2520Word%255D%29%2520%26page%3D2%23open-bibliography-panel">My Bibliography</a></li><li><a role="button" class="dropdown-block-link collections-trigger-target" href="https://account.ncbi.nlm.nih.gov/?back_url=https%3A%2F%2Fpubmed.ncbi.nlm.nih.gov%2F%3Fterm%3D%28hypertension%255BTitle%255D%29%2520AND%2520%28food%255BText%2520Word%255D%29%2520%26page%3D2%23open-collections-panel">Collections</a></li><li><a role="button" class="citation-manager-panel-trigger dropdown-block-link citation-manager-trigger-target" href="#">Citation manager</a></li></ul></div></div></div>
</div>

  
  <div class="selected-results-amount" title="" aria-live="off"></div>
  <button class="clear-selection-button" data-ga-category="clear_selection">Clear selection</button>
</div>
    </div>
    <div class="top-pagination">
      
        


<button class="button-wrapper first-page-btn" title="Navigate directly to the first page of results." data-ga-category="pagination" data-ga-action="Results_nav" data-ga-label="First_page_arrow_top" aria-label="Navigates to the first page of results.">
  <img src="https://cdn.ncbi.nlm.nih.gov/pubmed/6aa07a65-6caa-4bbc-acaa-48623b669c29/core/images/double-chevron-left-thin-blue.svg" class="chevron-icon enabled-icon" alt="first page">
  <img src="https://cdn.ncbi.nlm.nih.gov/pubmed/6aa07a65-6caa-4bbc-acaa-48623b669c29/core/images/double-chevron-left-thin-grey.svg" class="chevron-icon disabled-icon" alt="first page">
  
</button>

<button class="button-wrapper prev-page-btn" title="Navigate to the previous page of results." data-ga-category="pagination" data-ga-action="Results_nav" data-ga-label="Prev_page_arrow_top" aria-label="Navigates to the previous page of results.">
  <img src="https://cdn.ncbi.nlm.nih.gov/pubmed/6aa07a65-6caa-4bbc-acaa-48623b669c29/core/images/chevron-left-thin-blue.svg" class="chevron-icon enabled-icon" alt="previous page">
  <img src="https://cdn.ncbi.nlm.nih.gov/pubmed/6aa07a65-6caa-4bbc-acaa-48623b669c29/core/images/chevron-left-thin-grey.svg" class="chevron-icon disabled-icon" alt="previous page">
  
</button>

<div class="page-number-wrapper">
  <label for="page-number-input">Page</label>
  <form class="page-number-form">
    <input class="page-number" id="page-number-input" aria-label="page number input" title="Press Enter to navigate to the page number." type="number" min="1" max="183" data-ga-category="pagination" data-ga-action="Jump_to_page_top" value="2">
  </form>
  <label class="of-total-pages">of 183</label>
</div>

<button class="button-wrapper next-page-btn" title="Navigate to the next page of results." data-ga-category="pagination" data-ga-action="Results_nav" data-ga-label="Next_page_arrow_top" aria-label="Navigates to the next page of results.">
  
  <img src="https://cdn.ncbi.nlm.nih.gov/pubmed/6aa07a65-6caa-4bbc-acaa-48623b669c29/core/images/chevron-right-thin-blue.svg" class="chevron-icon enabled-icon" alt="next page">
  <img src="https://cdn.ncbi.nlm.nih.gov/pubmed/6aa07a65-6caa-4bbc-acaa-48623b669c29/core/images/chevron-right-thin-grey.svg" class="chevron-icon disabled-icon" alt="next page">
</button>

<button class="button-wrapper last-page-btn" title="Navigate directly to the last page of results." aria-label="Navigates to the last page of results." data-ga-category="pagination" data-ga-action="Results_nav" data-ga-label="Last_page_arrow_top" data-max-page="183">
  
  <img src="https://cdn.ncbi.nlm.nih.gov/pubmed/6aa07a65-6caa-4bbc-acaa-48623b669c29/core/images/double-chevron-right-thin-blue.svg" class="chevron-icon enabled-icon" alt="last page">
  <img src="https://cdn.ncbi.nlm.nih.gov/pubmed/6aa07a65-6caa-4bbc-acaa-48623b669c29/core/images/double-chevron-right-thin-grey.svg" class="chevron-icon disabled-icon" alt="last page">
</button>
      
    </div>
  </div>

  
  
  <div class="timeline-filter inline-timeline-filter">

    <h3 class="title">
      Results by year
    </h3>

    <button class="toggle-button" title="Expand/collapse timeline" disabled="">
      Expand/collapse timeline
    </button>

    <form id="export-search-by-year-form" class="export-search-by-year-form" action="/results-export-search-by-year/" method="post">
      <input type="hidden" name="csrfmiddlewaretoken" value="sXcYXzaFLKFHRX0o0yUeKm8kYyZpxgiSZsGy4hvUQ650c0B9IvSjrwtOec8h6uM9">
      <button type="submit" id="download-results-by-year-button" class="download-results-by-year-button" title="Download CSV" disabled="">
      </button>
    </form>

    <button class="reset-button" disabled="">
      Reset
    </button>

    <div class="inner-wrap">
      <div class="histogram">
        <svg xmlns="http://www.w3.org/2000/svg">
          <!-- Dynamic content -->
        </svg>

        <div class="hint">
          <span class="year"></span>
          <span class="count"></span>
        </div>
      </div>
      <div class="slider">
        <!-- Dynamic content -->
      </div>
    </div>
    
  </div>



  <div class="selected-results-container" id="page-label-selected-results-container">
  
    <div class="multiple-results-actions " role="region" aria-label="save, email, send to">
  <button id="page-label-save-results-panel-trigger" type="button" class="save-results save-results-panel-trigger" aria-expanded="false" aria-controls="save-action-panel" data-ga-category="save_share" data-ga-action="save" data-ga-label="open">
      Save
    </button><button id="page-label-email-results-panel-trigger" type="button" class="email-results email-results-login" aria-expanded="false" aria-controls="email-action-panel" data-login-url="https://account.ncbi.nlm.nih.gov/?back_url=https%3A%2F%2Fpubmed.ncbi.nlm.nih.gov%2F%3Fterm%3D%28hypertension%255BTitle%255D%29%2520AND%2520%28food%255BText%2520Word%255D%29%2520%26page%3D2%23open-email-panel" data-ga-category="save_share" data-ga-action="email" data-ga-label="open">
      Email
    </button><div class="more-actions dropdown-block"><button id="page-label-more-actions-trigger" type="button" class="trigger more-actions-trigger" ref="linksrc=show_moreactions_btn" aria-label="Send to" aria-controls="page-label-more-actions-dropdown" aria-expanded="false">Send to</button><div id="page-label-more-actions-dropdown" class="dropdown dropdown-container" aria-hidden="true"><div class="content"><ul class="more-actions-links"><li><a class="clipboard-panel-trigger dropdown-block-link " href="#" role="button" data-ga-category="save_share" data-ga-action="clipboard" data-ga-label="send">
                  Clipboard
                </a></li><li><a role="button" class="dropdown-block-link bibliography-trigger-target" href="https://account.ncbi.nlm.nih.gov/?back_url=https%3A%2F%2Fpubmed.ncbi.nlm.nih.gov%2F%3Fterm%3D%28hypertension%255BTitle%255D%29%2520AND%2520%28food%255BText%2520Word%255D%29%2520%26page%3D2%23open-bibliography-panel">My Bibliography</a></li><li><a role="button" class="dropdown-block-link collections-trigger-target" href="https://account.ncbi.nlm.nih.gov/?back_url=https%3A%2F%2Fpubmed.ncbi.nlm.nih.gov%2F%3Fterm%3D%28hypertension%255BTitle%255D%29%2520AND%2520%28food%255BText%2520Word%255D%29%2520%26page%3D2%23open-collections-panel">Collections</a></li><li><a role="button" class="citation-manager-panel-trigger dropdown-block-link citation-manager-trigger-target" href="#">Citation manager</a></li></ul></div></div></div>
</div>

  
  <div class="selected-results-amount" title="" aria-live="off"></div>
  <button class="clear-selection-button" data-ga-category="clear_selection">Clear selection</button>
</div>
  <div class="search-results-navigator">
  <button class="current-page-label" href="https://pubmed.ncbi.nlm.nih.gov/?term=(hypertension%5BTitle%5D)%20AND%20(food%5BText%20Word%5D)%20&amp;page=2"><span class="transition-in" style="top: 0px; opacity: 1;">Page 2</span></button>
</div>

  




  


<section class="search-results-list">
  

  <div class="applied-filters-message usa-alert usa-alert-slim usa-alert-success hide">
    <div class="usa-alert-body">
      <div class="usa-alert-text">
        Filters applied: <span class="filter-titles"></span>. <a href="#" class="clear-filters" data-ga-category="filter" data-ga-action="remove_filter" data-ga-label="clear_banner">Clear&nbsp;all</a>
      </div>
    </div>
  </div>

  

  


  










  

  

  

  
    <label id="result-selector-label" class="usa-sr-only">Select search result to email or save</label>
    <div class="search-results-chunks">
      

<div class="search-results-chunk results-chunk" data-prev-page-url="/more/?term=%28hypertension%5BTitle%5D%29+AND+%28food%5BText+Word%5D%29" data-next-page-url="/more/?term=%28hypertension%5BTitle%5D%29+AND+%28food%5BText+Word%5D%29&amp;page=3" data-page-number="2" data-results-amount="1,827" data-pages-amount="183" data-max-page="183" data-chunk-ids="35910428,26449129,35417736,39975789,40405724,31023830,33541612,28818842,39067698,23627503">
  <div class="title ">
    <span class="text">Page 2</span>
  </div>

  




  

  
    
      




  <article class="full-docsum" data-rel-pos="1">
    


<div class="item-selector-wrap selectors-and-actions first-selector">
  <input class="search-result-selector" type="checkbox" name="search-result-selector-35910428" id="select-35910428" value="35910428" aria-labelledby="result-selector-label">
  
  <label class="search-result-position" for="select-35910428"><span class="position-number">11</span></label>
  

  
    



  <div class="result-actions-bar side-bar">


  <div class="cite dropdown-block">
    
    <button class="cite-search-result trigger result-action-trigger citation-dialog-trigger" aria-haspopup="true" data-ga-category="save_share" data-ga-action="cite" data-ga-label="open" data-all-citations-url="/35910428/citations/" data-citation-style="nlm" data-pubmed-format-link="/35910428/export/" aria-expanded="false">
      Cite
    </button>
  </div>



  </div>


  
</div>

    <div class="docsum-wrap">
      <div class="docsum-content">
        
          
            
            
            <a class="docsum-title" href="/35910428/" ref="linksrc=docsum_link&amp;article_id=35910428&amp;ordinalpos=1&amp;page=2" data-ga-category="result_click" data-ga-action="11" data-ga-label="35910428" data-full-article-url="from_term=%28hypertension%5BTitle%5D%29+AND+%28food%5BText+Word%5D%29+&amp;from_page=2&amp;from_pos=1" data-article-id="35910428">
              
                <b>Food</b> Choices and <b>Hypertension</b> Among Rural Thais: Evidence From a Discrete Choice Experiment.
              
            </a><span class="easyScholarPaperFlag" paperid="2499"> </span>
            <div class="docsum-citation full-citation">
  
    
      
        <span class="docsum-authors full-authors">Rusmevichientong P, Nguyen H, Morales C, Jaynes J, Wood MM.</span>
        
      
    
    <span class="docsum-authors short-authors">Rusmevichientong P, et al.</span>
    <span class="docsum-journal-citation full-journal-citation">Int J Public Health. 2022 Jul 15;67:1604850. doi: 10.3389/ijph.2022.1604850. eCollection 2022.<a class="easyScholarDOI" target="_blank" href="https://www.sci-hub.vg/10.3389/ijph.2022.1604850"><svg version="1.1" id="Layer_1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" x="0px" y="0px" width="22px" height="22px" viewBox="0 0 32 32" enable-background="new 0 0 32 32" xml:space="preserve">  <image id="image0" width="32" height="32" x="0" y="0" href="data:image/png;base64,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"></image></svg></a></span>
    <span class="docsum-journal-citation short-journal-citation">Int J Public Health. 2022.</span>
  
  
  
  <span class="citation-part">PMID: <span class="docsum-pmid">35910428</span></span>
  <span class="free-resources spaced-citation-item citation-part">Free PMC article.</span>
  
    
  
  
  
  
  
</div>

          
        
        
          <div class="docsum-snippet">
            <div class="full-view-snippet">
              This study explored hypertensive-related <b>food</b> choices between normotensive and hypertensive people residing in rural northern Thailand to determine which <b>food</b> attributes influence their choices. Methods: The study conducted a discrete choice experiment (DCE) survey …
            </div>
            <div class="short-view-snippet">
              This study explored hypertensive-related <b>food</b> choices between normotensive and hypertensive people residing in rural northern Thailan …
            </div>
          </div>
        
      </div>
      
        



  <div class="result-actions-bar bottom-bar">


  <div class="cite dropdown-block">
    
    <button class="cite-search-result trigger result-action-trigger citation-dialog-trigger" aria-haspopup="true" data-ga-category="save_share" data-ga-action="cite" data-ga-label="open" data-all-citations-url="/35910428/citations/" data-citation-style="nlm" data-pubmed-format-link="/35910428/export/" aria-expanded="false">
      Cite
    </button>
  </div>


  <div class="in-clipboard-label" hidden="hidden">
  Item in Clipboard
</div>


  </div>


      
    </div>
  </article>


    
  
    
      




  <article class="full-docsum" data-rel-pos="2">
    


<div class="item-selector-wrap selectors-and-actions">
  <input class="search-result-selector" type="checkbox" name="search-result-selector-26449129" id="select-26449129" value="26449129" aria-labelledby="result-selector-label">
  
  <label class="search-result-position" for="select-26449129"><span class="position-number">12</span></label>
  

  
    



  <div class="result-actions-bar side-bar">


  <div class="cite dropdown-block">
    
    <button class="cite-search-result trigger result-action-trigger citation-dialog-trigger" aria-haspopup="true" data-ga-category="save_share" data-ga-action="cite" data-ga-label="open" data-all-citations-url="/26449129/citations/" data-citation-style="nlm" data-pubmed-format-link="/26449129/export/" aria-expanded="false">
      Cite
    </button>
  </div>



  </div>


  
</div>

    <div class="docsum-wrap">
      <div class="docsum-content">
        
          
            
            
            <a class="docsum-title" href="/26449129/" ref="linksrc=docsum_link&amp;article_id=26449129&amp;ordinalpos=2&amp;page=2" data-ga-category="result_click" data-ga-action="12" data-ga-label="26449129" data-full-article-url="from_term=%28hypertension%5BTitle%5D%29+AND+%28food%5BText+Word%5D%29+&amp;from_page=2&amp;from_pos=2" data-article-id="26449129">
              
                Association between fried <b>food</b> consumption and <b>hypertension</b> in Korean adults.
              
            </a><span class="easyScholarPaperFlag" paperid="91051"> </span>
            <div class="docsum-citation full-citation">
  
    
      
        <span class="docsum-authors full-authors">Kang Y, Kim J.</span>
        
      
    
    <span class="docsum-authors short-authors">Kang Y, et al.</span>
    <span class="docsum-journal-citation full-journal-citation">Br J Nutr. 2016 Jan 14;115(1):87-94. doi: 10.1017/S000711451500402X. Epub 2015 Oct 9.<a class="easyScholarDOI" target="_blank" href="https://www.sci-hub.vg/10.1017/S000711451500402X"><svg version="1.1" id="Layer_1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" x="0px" y="0px" width="22px" height="22px" viewBox="0 0 32 32" enable-background="new 0 0 32 32" xml:space="preserve">  <image id="image0" width="32" height="32" x="0" y="0" href="data:image/png;base64,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"></image></svg></a></span>
    <span class="docsum-journal-citation short-journal-citation">Br J Nutr. 2016.</span>
  
  
  
  <span class="citation-part">PMID: <span class="docsum-pmid">26449129</span></span>
  
  
    
  
  
  
  
  
</div>

          
        
        
          <div class="docsum-snippet">
            <div class="full-view-snippet">
              Adjusted OR for elevated blood pressure significantly increased in men (OR 1.62; 95% CI 1.11, 2.37; P(trend)=0.0447) and women (OR 2.20; 95% CI 1.21, 4.00; P(trend)=0.0403) with a greater than twice a week consumption of fried <b>food</b> compared with those who rarely consumed f …
            </div>
            <div class="short-view-snippet">
              Adjusted OR for elevated blood pressure significantly increased in men (OR 1.62; 95% CI 1.11, 2.37; P(trend)=0.0447) and women (OR 2.20; 95% …
            </div>
          </div>
        
      </div>
      
        



  <div class="result-actions-bar bottom-bar">


  <div class="cite dropdown-block">
    
    <button class="cite-search-result trigger result-action-trigger citation-dialog-trigger" aria-haspopup="true" data-ga-category="save_share" data-ga-action="cite" data-ga-label="open" data-all-citations-url="/26449129/citations/" data-citation-style="nlm" data-pubmed-format-link="/26449129/export/" aria-expanded="false">
      Cite
    </button>
  </div>


  <div class="in-clipboard-label" hidden="hidden">
  Item in Clipboard
</div>


  </div>


      
    </div>
  </article>


    
  
    
      




  <article class="full-docsum" data-rel-pos="3">
    


<div class="item-selector-wrap selectors-and-actions">
  <input class="search-result-selector" type="checkbox" name="search-result-selector-35417736" id="select-35417736" value="35417736" aria-labelledby="result-selector-label">
  
  <label class="search-result-position" for="select-35417736"><span class="position-number">13</span></label>
  

  
    



  <div class="result-actions-bar side-bar">


  <div class="cite dropdown-block">
    
    <button class="cite-search-result trigger result-action-trigger citation-dialog-trigger" aria-haspopup="true" data-ga-category="save_share" data-ga-action="cite" data-ga-label="open" data-all-citations-url="/35417736/citations/" data-citation-style="nlm" data-pubmed-format-link="/35417736/export/" aria-expanded="false">
      Cite
    </button>
  </div>



  </div>


  
</div>

    <div class="docsum-wrap">
      <div class="docsum-content">
        
          
            
            
            <a class="docsum-title" href="/35417736/" ref="linksrc=docsum_link&amp;article_id=35417736&amp;ordinalpos=3&amp;page=2" data-ga-category="result_click" data-ga-action="13" data-ga-label="35417736" data-full-article-url="from_term=%28hypertension%5BTitle%5D%29+AND+%28food%5BText+Word%5D%29+&amp;from_page=2&amp;from_pos=3" data-article-id="35417736">
              
                <b>Hypertension</b> and the Role of Dietary Fiber.
              
            </a><span class="easyScholarPaperFlag" paperid="61150"> </span>
            <div class="docsum-citation full-citation">
  
    
      
        <span class="docsum-authors full-authors">Nepali P, Suresh S, Pikale G, Jhaveri S, Avanthika C, Bansal M, Islam R, Chanpura A.</span>
        
      
    
    <span class="docsum-authors short-authors">Nepali P, et al.</span>
    <span class="docsum-journal-citation full-journal-citation">Curr Probl Cardiol. 2022 Jul;47(7):101203. doi: 10.1016/j.cpcardiol.2022.101203. Epub 2022 Apr 10.<a class="easyScholarDOI" target="_blank" href="https://www.sci-hub.vg/10.1016/j.cpcardiol.2022.101203"><svg version="1.1" id="Layer_1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" x="0px" y="0px" width="22px" height="22px" viewBox="0 0 32 32" enable-background="new 0 0 32 32" xml:space="preserve">  <image id="image0" width="32" height="32" x="0" y="0" href="data:image/png;base64,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"></image></svg></a></span>
    <span class="docsum-journal-citation short-journal-citation">Curr Probl Cardiol. 2022.</span>
  
  
  
  <span class="citation-part">PMID: <span class="docsum-pmid">35417736</span></span>
  
  
    
  
  <span class="publication-type spaced-citation-item citation-part">Review.</span>
  
  
  
</div>

          
        
        
          <div class="docsum-snippet">
            <div class="full-view-snippet">
              But simply switching to healthy alternatives is not enough and must happen in tandem with dietary supplementation. The consumption of ultra-processed <b>food</b> has only increased in recent times. Hence, we feel the need to focus on dietary interventions in managing hypertension …
            </div>
            <div class="short-view-snippet">
              But simply switching to healthy alternatives is not enough and must happen in tandem with dietary supplementation. The consumption of ultra- …
            </div>
          </div>
        
      </div>
      
        



  <div class="result-actions-bar bottom-bar">


  <div class="cite dropdown-block">
    
    <button class="cite-search-result trigger result-action-trigger citation-dialog-trigger" aria-haspopup="true" data-ga-category="save_share" data-ga-action="cite" data-ga-label="open" data-all-citations-url="/35417736/citations/" data-citation-style="nlm" data-pubmed-format-link="/35417736/export/" aria-expanded="false">
      Cite
    </button>
  </div>


  <div class="in-clipboard-label" hidden="hidden">
  Item in Clipboard
</div>


  </div>


      
    </div>
  </article>


    
  
    
      




  <article class="full-docsum" data-rel-pos="4">
    


<div class="item-selector-wrap selectors-and-actions">
  <input class="search-result-selector" type="checkbox" name="search-result-selector-39975789" id="select-39975789" value="39975789" aria-labelledby="result-selector-label">
  
  <label class="search-result-position" for="select-39975789"><span class="position-number">14</span></label>
  

  
    



  <div class="result-actions-bar side-bar">


  <div class="cite dropdown-block">
    
    <button class="cite-search-result trigger result-action-trigger citation-dialog-trigger" aria-haspopup="true" data-ga-category="save_share" data-ga-action="cite" data-ga-label="open" data-all-citations-url="/39975789/citations/" data-citation-style="nlm" data-pubmed-format-link="/39975789/export/" aria-expanded="false">
      Cite
    </button>
  </div>



  </div>


  
</div>

    <div class="docsum-wrap">
      <div class="docsum-content">
        
          
            
            
            <a class="docsum-title" href="/39975789/" ref="linksrc=docsum_link&amp;article_id=39975789&amp;ordinalpos=4&amp;page=2" data-ga-category="result_click" data-ga-action="14" data-ga-label="39975789" data-full-article-url="from_term=%28hypertension%5BTitle%5D%29+AND+%28food%5BText+Word%5D%29+&amp;from_page=2&amp;from_pos=4" data-article-id="39975789">
              
                Connections between redlining, <b>food</b> access, <b>hypertension</b>, diabetes, and obesity in Boston.
              
            </a><span class="easyScholarPaperFlag" paperid="46375"> </span>
            <div class="docsum-citation full-citation">
  
    
      
        <span class="docsum-authors full-authors">Mehrtash F.</span>
        
      
    
    <span class="docsum-authors short-authors">Mehrtash F.</span>
    <span class="docsum-journal-citation full-journal-citation">Front Public Health. 2025 Feb 5;13:1505462. doi: 10.3389/fpubh.2025.1505462. eCollection 2025.<a class="easyScholarDOI" target="_blank" href="https://www.sci-hub.vg/10.3389/fpubh.2025.1505462"><svg version="1.1" id="Layer_1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" x="0px" y="0px" width="22px" height="22px" viewBox="0 0 32 32" enable-background="new 0 0 32 32" xml:space="preserve">  <image id="image0" width="32" height="32" x="0" y="0" href="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAABGdBTUEAALGPC/xhBQAAACBjSFJNAAB6JgAAgIQAAPoAAACA6AAAdTAAAOpgAAA6mAAAF3CculE8AAAABmJLR0QA/wD/AP+gvaeTAAAHdklEQVRYw+1WW2xcVxVd59zn3JnxPDwzHo89fsexYzvO02nSPBQgRMGqVEgFtEiABCriK0L8RHwgJFQJfpCgX6SFQgskqAlRcKAlhJa2zosSJ07i2LXj58Rjz4zHd9535r4OH3YSkiYQARI/WdLRlY7u2Xvdu89aewNP8AT/Z5DHeakmXMs3d25usKRApGBwzrJuc5ZtW7D0Cge9RCtqMp+YXEzGZ8v/UwKR+gaxofdTT6VQ/4mK4NsQqvaFo0GXFPTIkEUOFd20UpmSFkuk04uLySlWTAw5iuPnZ6+9P2Waxn9HYNOuAy2qa+PzXFV0394trU3PbG/x9TT7eb9bgihQEAIwBhimDTVfNkdm0tpbF6dTf7o4OppPTJ11ZYdOT1wdjP9HBNbv/lxvQtn4ze2be/YeOrgx3NdZI4s8BRjAAICxleedIISAEMAwLPP61FL55RNX4mfOD58LGRPHbg8NvJ/JqPajCHAPbnQ//Wx3yr31Wy/079j30te213Y2Vou5oo5c0UDZsHBpLImiZoIQAqfMgxDAshksm4HjKI0EXeKeDfWetMY3XIrRtWs61rmaq7nY3OxM8d8SaO3aUq36dx36woGnP/Pdr/QF/W4HDwDzSyUIPEWVIuDCaBK1fgVhv4KF5RKyRQNT8Rxup4sIemRwlECRBdoR9Urnx3OhyTTX1tvT3bB3Q21mbOyj+YpuPJqAs/PZg90bt77wgxd3NgQ8Dt5mDIQQpLJlKBIPr0uGIvHIlXQ011YhldVwYTQFReZBQOB3S5BFDowBHqdEP4oVxOuxoi9dFqLPP7O789Nbwk41OTc3u5Ap3cnJ3/369Tsjmrtx/9f7u2sjASdv2ytVZmCwbQaeoyiVDUwv5hDyOhBL5mFZDC6Zh5qvwCFx4DmKO5eDEgKRpyCE8gWDBGMFx1NfPfiNSMRV7Gg9dvTnr52J37iPgOnr3LZuTUPnng1RN2P3rphtAy4HD5eDR7FsQhQ4ZIo6qhQB7fUetEaq7v1OSsAAUEqQUDUMTS+DEsBmhLcYdQUCgfbN+1/0Sbd/5w14ml4fuMaP8wDQtrbbkxfD27Z1RcPVbpm3VwlQQgAKREMuMAZ4XRz29tZiVQgAAIEjYFgp1R0kMxp+fHIUN2czIIRAESk2rfGDUso73b5gS9S3u784JIQa+sd4n9frbO/pW3e57O9oi/rdIABhwFKujLFYFoQSVLsleJ0iFImHwFNwlNz1AdNmqOgWskUdC6qG69Mq3rocx7UpFZbNIPAUX9zdhF1dNSvVSQ/zkjblCzqxZi1JKHwo4AnvaDFad9c7wl31Th4gYITA65IQ8Mh4d3gRl8eXkcqvuKzMc5BEHhwlsC0bmm4hV9ahFnRkCwZKFROEAG6HgLa6Kjy3swGf3dEIhyzATA5Bu/Qd09IyhmYiu2RIizwjIoMcMvfXXEPr4t9RMXvBhbaDVjWjM+pFR4MPamFFajfnMpiM5zG/VIRa1KHpFizbBqUE9QEnuqMiwn4HWiJudDX6sDbqhc9JYOdmUBk7gcrIK6aZmSmn8hgbTvr/eGqaDROPx6N8sv/z6yvBvsOH9sl7tyuDspm8DMJJoP51oNXrwXnawbnrQCQ/GOeAyQToFoFhMdgMIATgKSByNgQYoFYOdiEOM30D5sIgrIVBWLlZs1yx1UQeIxfjwWOvXao6OXRjKkMAoKOzy11pee7whk19X/rZt3cFFSPGm/PvwLp9Flb6OlBZBqgIIvlAZD+I5AcRqwDeAUJ4MGYBpgam58DKS7C1FFBOgVXygM3AALNgcAu38sF3/zxd98aRgYlBNZOz7+sFG/d9eafq2fa9Vw/3b93TWyfbAGDqsEtx2Ooo7PQV2Ms3YWcnwbQEoGfBTA2wjRXts9VoBADlQTgHiOSF5YiYKdasjmQip0/8ZeInR48P3Pxn87vrA7NX3r4o9gT/cOT3wzW9rdUtHqfIM8qDuptAq5qAhgOAbYKZRbBKBqioYBUVTM8BZgnMNgFCQDgJENygsh+m4McrZxbLA+cmh0OlK7868UDy+6xYKxXtgGJPj2ccIU5y1fd1hJ08RykYWxU9W00gg0heECUM6mkG9XWAVveAC/SCC6wH9XeB87aBuurw5oV04YdHhyaU4q03Lpx+dUDX9X/djDKp+WK1S5z5cA5BTlRqetuCTlHgKGMPHlslxD6+CADTtMzj701kX/rFBzfF3MTruZFTv0kmFh86oXysHecSU8tehU6cu1VxxjOWp7XO6/C5ZcpxlILhkaCEgIGZiXRBf/nk1cSPfv3eIEtd/eny8PE347dj+qPOcQ/bzCWmln1C8eq1mFY4O5zi1bxB3Q6ROh08EXgOhMAG7i2tbOhTcTV//K/jqe//8oMbb79z8ZSy/OGRyfO/PaeVio8cRu5TwcMgiBJq1u5sLbvatlcF6je1N0Ua2xuD1SGfwimyIFQqppHKlqxbsXRmfHZxPp2I35BL0+cLc38bUZcSJh4DjzUVA4AvVC+J3mjQEjx+RiWFEULAGCN2pcQZOdXMxZeWF2e0x433BE9wB/8Aa3ZiVq1gDAMAAAAldEVYdGRhdGU6Y3JlYXRlADIwMjItMTItMDFUMTQ6NDQ6MDIrMDE6MDBW0C0AAAAAJXRFWHRkYXRlOm1vZGlmeQAyMDIyLTEyLTAxVDE0OjQ0OjAyKzAxOjAwJ42VvAAAAABJRU5ErkJggg=="></image></svg></a></span>
    <span class="docsum-journal-citation short-journal-citation">Front Public Health. 2025.</span>
  
  
  
  <span class="citation-part">PMID: <span class="docsum-pmid">39975789</span></span>
  <span class="free-resources spaced-citation-item citation-part">Free PMC article.</span>
  
    
  
  
  
  
  
</div>

          
        
        
          <div class="docsum-snippet">
            <div class="full-view-snippet">
              The findings underscore the need for comprehensive policies and interventions with community-based involvement to address <b>food</b> insecurity and health disparities that originated from redlining in Boston....
            </div>
            <div class="short-view-snippet">
              The findings underscore the need for comprehensive policies and interventions with community-based involvement to address <b>food</b> insecu …
            </div>
          </div>
        
      </div>
      
        



  <div class="result-actions-bar bottom-bar">


  <div class="cite dropdown-block">
    
    <button class="cite-search-result trigger result-action-trigger citation-dialog-trigger" aria-haspopup="true" data-ga-category="save_share" data-ga-action="cite" data-ga-label="open" data-all-citations-url="/39975789/citations/" data-citation-style="nlm" data-pubmed-format-link="/39975789/export/" aria-expanded="false">
      Cite
    </button>
  </div>


  <div class="in-clipboard-label" hidden="hidden">
  Item in Clipboard
</div>


  </div>


      
    </div>
  </article>


    
  
    
      




  <article class="full-docsum" data-rel-pos="5">
    


<div class="item-selector-wrap selectors-and-actions">
  <input class="search-result-selector" type="checkbox" name="search-result-selector-40405724" id="select-40405724" value="40405724" aria-labelledby="result-selector-label">
  
  <label class="search-result-position" for="select-40405724"><span class="position-number">15</span></label>
  

  
    



  <div class="result-actions-bar side-bar">


  <div class="cite dropdown-block">
    
    <button class="cite-search-result trigger result-action-trigger citation-dialog-trigger" aria-haspopup="true" data-ga-category="save_share" data-ga-action="cite" data-ga-label="open" data-all-citations-url="/40405724/citations/" data-citation-style="nlm" data-pubmed-format-link="/40405724/export/" aria-expanded="false">
      Cite
    </button>
  </div>



  </div>


  
</div>

    <div class="docsum-wrap">
      <div class="docsum-content">
        
          
            
            
            <a class="docsum-title" href="/40405724/" ref="linksrc=docsum_link&amp;article_id=40405724&amp;ordinalpos=5&amp;page=2" data-ga-category="result_click" data-ga-action="15" data-ga-label="40405724" data-full-article-url="from_term=%28hypertension%5BTitle%5D%29+AND+%28food%5BText+Word%5D%29+&amp;from_page=2&amp;from_pos=5" data-article-id="40405724">
              
                Treatment of pulmonary <b>hypertension</b> after seven world symposia.
              
            </a><span class="easyScholarPaperFlag" paperid="40073"> </span>
            <div class="docsum-citation full-citation">
  
    
      
        <span class="docsum-authors full-authors">Estrada RA, Sahay S, Tonelli AR.</span>
        
      
    
    <span class="docsum-authors short-authors">Estrada RA, et al.</span>
    <span class="docsum-journal-citation full-journal-citation">Ther Adv Respir Dis. 2025 Jan-Dec;19:17534666251342898. doi: 10.1177/17534666251342898. Epub 2025 May 23.<a class="easyScholarDOI" target="_blank" href="https://www.sci-hub.vg/10.1177/17534666251342898"><svg version="1.1" id="Layer_1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" x="0px" y="0px" width="22px" height="22px" viewBox="0 0 32 32" enable-background="new 0 0 32 32" xml:space="preserve">  <image id="image0" width="32" height="32" x="0" y="0" href="data:image/png;base64,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"></image></svg></a></span>
    <span class="docsum-journal-citation short-journal-citation">Ther Adv Respir Dis. 2025.</span>
  
  
  
  <span class="citation-part">PMID: <span class="docsum-pmid">40405724</span></span>
  <span class="free-resources spaced-citation-item citation-part">Free PMC article.</span>
  
    
  
  <span class="publication-type spaced-citation-item citation-part">Review.</span>
  
  
  
</div>

          
        
        
          <div class="docsum-snippet">
            <div class="full-view-snippet">
              This review focuses on the advancements in the treatment of pulmonary hypertension (PH), especially after the <b>Food</b> and Drug Administration (FDA) approval of sotatercept and the advances in treatment recommendations after seven World Symposia on PH. ...
            </div>
            <div class="short-view-snippet">
              This review focuses on the advancements in the treatment of pulmonary hypertension (PH), especially after the <b>Food</b> and Drug Administr …
            </div>
          </div>
        
      </div>
      
        



  <div class="result-actions-bar bottom-bar">


  <div class="cite dropdown-block">
    
    <button class="cite-search-result trigger result-action-trigger citation-dialog-trigger" aria-haspopup="true" data-ga-category="save_share" data-ga-action="cite" data-ga-label="open" data-all-citations-url="/40405724/citations/" data-citation-style="nlm" data-pubmed-format-link="/40405724/export/" aria-expanded="false">
      Cite
    </button>
  </div>


  <div class="in-clipboard-label" hidden="hidden">
  Item in Clipboard
</div>


  </div>


      
    </div>
  </article>


    
  
    
      




  <article class="full-docsum" data-rel-pos="6">
    


<div class="item-selector-wrap selectors-and-actions">
  <input class="search-result-selector" type="checkbox" name="search-result-selector-31023830" id="select-31023830" value="31023830" aria-labelledby="result-selector-label">
  
  <label class="search-result-position" for="select-31023830"><span class="position-number">16</span></label>
  

  
    



  <div class="result-actions-bar side-bar">


  <div class="cite dropdown-block">
    
    <button class="cite-search-result trigger result-action-trigger citation-dialog-trigger" aria-haspopup="true" data-ga-category="save_share" data-ga-action="cite" data-ga-label="open" data-all-citations-url="/31023830/citations/" data-citation-style="nlm" data-pubmed-format-link="/31023830/export/" aria-expanded="false">
      Cite
    </button>
  </div>



  </div>


  
</div>

    <div class="docsum-wrap">
      <div class="docsum-content">
        
          
            
            
            <a class="docsum-title" href="/31023830/" ref="linksrc=docsum_link&amp;article_id=31023830&amp;ordinalpos=6&amp;page=2" data-ga-category="result_click" data-ga-action="16" data-ga-label="31023830" data-full-article-url="from_term=%28hypertension%5BTitle%5D%29+AND+%28food%5BText+Word%5D%29+&amp;from_page=2&amp;from_pos=6" data-article-id="31023830">
              
                Research Gaps in Primary Pediatric <b>Hypertension</b>.
              
            </a><span class="easyScholarPaperFlag" paperid="29151"> </span>
            <div class="docsum-citation full-citation">
  
    
      
        <span class="docsum-authors full-authors">Taylor-Zapata P, Baker-Smith CM, Burckart G, Daniels SR, Flynn JT, Giacoia G, Green D, Kelly AS, Khurana M, Li JS, Pratt C, Urbina EM, Zajicek A.</span>
        
      
    
    <span class="docsum-authors short-authors">Taylor-Zapata P, et al.</span>
    <span class="docsum-journal-citation full-journal-citation">Pediatrics. 2019 May;143(5):e20183517. doi: 10.1542/peds.2018-3517.<a class="easyScholarDOI" target="_blank" href="https://www.sci-hub.vg/10.1542/peds.2018-3517"><svg version="1.1" id="Layer_1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" x="0px" y="0px" width="22px" height="22px" viewBox="0 0 32 32" enable-background="new 0 0 32 32" xml:space="preserve">  <image id="image0" width="32" height="32" x="0" y="0" href="data:image/png;base64,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"></image></svg></a></span>
    <span class="docsum-journal-citation short-journal-citation">Pediatrics. 2019.</span>
  
  
  
  <span class="citation-part">PMID: <span class="docsum-pmid">31023830</span></span>
  <span class="free-resources spaced-citation-item citation-part">Free PMC article.</span>
  
    
  
  <span class="publication-type spaced-citation-item citation-part">Review.</span>
  
  
  
</div>

          
        
        
          <div class="docsum-snippet">
            <div class="full-view-snippet">
              The Eunice Kennedy Shriver National Institute of Child Health and Human Development, in collaboration with the National Heart, Lung, and Blood Institute and the US <b>Food</b> and Drug Administration, sponsored a workshop of experts to discuss the current state of childhood prima …
            </div>
            <div class="short-view-snippet">
              The Eunice Kennedy Shriver National Institute of Child Health and Human Development, in collaboration with the National Heart, Lung, and Blo …
            </div>
          </div>
        
      </div>
      
        



  <div class="result-actions-bar bottom-bar">


  <div class="cite dropdown-block">
    
    <button class="cite-search-result trigger result-action-trigger citation-dialog-trigger" aria-haspopup="true" data-ga-category="save_share" data-ga-action="cite" data-ga-label="open" data-all-citations-url="/31023830/citations/" data-citation-style="nlm" data-pubmed-format-link="/31023830/export/" aria-expanded="false">
      Cite
    </button>
  </div>


  <div class="in-clipboard-label" hidden="hidden">
  Item in Clipboard
</div>


  </div>


      
    </div>
  </article>


    
  
    
      




  <article class="full-docsum" data-rel-pos="7">
    


<div class="item-selector-wrap selectors-and-actions">
  <input class="search-result-selector" type="checkbox" name="search-result-selector-33541612" id="select-33541612" value="33541612" aria-labelledby="result-selector-label">
  
  <label class="search-result-position" for="select-33541612"><span class="position-number">17</span></label>
  

  
    



  <div class="result-actions-bar side-bar">


  <div class="cite dropdown-block">
    
    <button class="cite-search-result trigger result-action-trigger citation-dialog-trigger" aria-haspopup="true" data-ga-category="save_share" data-ga-action="cite" data-ga-label="open" data-all-citations-url="/33541612/citations/" data-citation-style="nlm" data-pubmed-format-link="/33541612/export/" aria-expanded="false">
      Cite
    </button>
  </div>



  </div>


  
</div>

    <div class="docsum-wrap">
      <div class="docsum-content">
        
          
            
            
            <a class="docsum-title" href="/33541612/" ref="linksrc=docsum_link&amp;article_id=33541612&amp;ordinalpos=7&amp;page=2" data-ga-category="result_click" data-ga-action="17" data-ga-label="33541612" data-full-article-url="from_term=%28hypertension%5BTitle%5D%29+AND+%28food%5BText+Word%5D%29+&amp;from_page=2&amp;from_pos=7" data-article-id="33541612">
              
                Pulmonary Arterial <b>Hypertension</b> Secondary to Drugs and Toxins.
              
            </a><span class="easyScholarPaperFlag" paperid="51153"> </span>
            <div class="docsum-citation full-citation">
  
    
      
        <span class="docsum-authors full-authors">Ramirez RL 3rd, Pienkos SM, de Jesus Perez V, Zamanian RT.</span>
        
      
    
    <span class="docsum-authors short-authors">Ramirez RL 3rd, et al.</span>
    <span class="docsum-journal-citation full-journal-citation">Clin Chest Med. 2021 Mar;42(1):19-38. doi: 10.1016/j.ccm.2020.11.008.<a class="easyScholarDOI" target="_blank" href="https://www.sci-hub.vg/10.1016/j.ccm.2020.11.008"><svg version="1.1" id="Layer_1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" x="0px" y="0px" width="22px" height="22px" viewBox="0 0 32 32" enable-background="new 0 0 32 32" xml:space="preserve">  <image id="image0" width="32" height="32" x="0" y="0" href="data:image/png;base64,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"></image></svg></a></span>
    <span class="docsum-journal-citation short-journal-citation">Clin Chest Med. 2021.</span>
  
  
  
  <span class="citation-part">PMID: <span class="docsum-pmid">33541612</span></span>
  
  
    
  
  <span class="publication-type spaced-citation-item citation-part">Review.</span>
  
  
  
</div>

          
        
        
          <div class="docsum-snippet">
            <div class="full-view-snippet">
              Many drugs and toxins have emerged as risk factors for pulmonary arterial hypertension, which include anorexigens, illicit agents, and several US <b>Food</b> and Drug Administration-approved therapeutic medications. Drugs and toxins are classified as possible or definite risk fac …
            </div>
            <div class="short-view-snippet">
              Many drugs and toxins have emerged as risk factors for pulmonary arterial hypertension, which include anorexigens, illicit agents, and sever …
            </div>
          </div>
        
      </div>
      
        



  <div class="result-actions-bar bottom-bar">


  <div class="cite dropdown-block">
    
    <button class="cite-search-result trigger result-action-trigger citation-dialog-trigger" aria-haspopup="true" data-ga-category="save_share" data-ga-action="cite" data-ga-label="open" data-all-citations-url="/33541612/citations/" data-citation-style="nlm" data-pubmed-format-link="/33541612/export/" aria-expanded="false">
      Cite
    </button>
  </div>


  <div class="in-clipboard-label" hidden="hidden">
  Item in Clipboard
</div>


  </div>


      
    </div>
  </article>


    
  
    
      




  <article class="full-docsum" data-rel-pos="8">
    


<div class="item-selector-wrap selectors-and-actions">
  <input class="search-result-selector" type="checkbox" name="search-result-selector-28818842" id="select-28818842" value="28818842" aria-labelledby="result-selector-label">
  
  <label class="search-result-position" for="select-28818842"><span class="position-number">18</span></label>
  

  
    



  <div class="result-actions-bar side-bar">


  <div class="cite dropdown-block">
    
    <button class="cite-search-result trigger result-action-trigger citation-dialog-trigger" aria-haspopup="true" data-ga-category="save_share" data-ga-action="cite" data-ga-label="open" data-all-citations-url="/28818842/citations/" data-citation-style="nlm" data-pubmed-format-link="/28818842/export/" aria-expanded="false">
      Cite
    </button>
  </div>



  </div>


  
</div>

    <div class="docsum-wrap">
      <div class="docsum-content">
        
          
            
            
            <a class="docsum-title" href="/28818842/" ref="linksrc=docsum_link&amp;article_id=28818842&amp;ordinalpos=8&amp;page=2" data-ga-category="result_click" data-ga-action="18" data-ga-label="28818842" data-full-article-url="from_term=%28hypertension%5BTitle%5D%29+AND+%28food%5BText+Word%5D%29+&amp;from_page=2&amp;from_pos=8" data-article-id="28818842">
              
                What's new in paediatric <b>hypertension</b>?
              
            </a><span class="easyScholarPaperFlag" paperid="32277"> </span>
            <div class="docsum-citation full-citation">
  
    
      
        <span class="docsum-authors full-authors">Lalji R, Tullus K.</span>
        
      
    
    <span class="docsum-authors short-authors">Lalji R, et al.</span>
    <span class="docsum-journal-citation full-journal-citation">Arch Dis Child. 2018 Jan;103(1):96-100. doi: 10.1136/archdischild-2016-311662. Epub 2017 Aug 17.<a class="easyScholarDOI" target="_blank" href="https://www.sci-hub.vg/10.1136/archdischild-2016-311662"><svg version="1.1" id="Layer_1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" x="0px" y="0px" width="22px" height="22px" viewBox="0 0 32 32" enable-background="new 0 0 32 32" xml:space="preserve">  <image id="image0" width="32" height="32" x="0" y="0" href="data:image/png;base64,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"></image></svg></a></span>
    <span class="docsum-journal-citation short-journal-citation">Arch Dis Child. 2018.</span>
  
  
  
  <span class="citation-part">PMID: <span class="docsum-pmid">28818842</span></span>
  
  
    
  
  <span class="publication-type spaced-citation-item citation-part">Review.</span>
  
  
  
</div>

          
        
        
          <div class="docsum-snippet">
            <div class="full-view-snippet">
              High dietary salt intake is a risk factor for cardiovascular disease. Given the rise in processed <b>food</b> consumption, children in developed nations are likely to benefit from salt restriction at a population-based level....
            </div>
            <div class="short-view-snippet">
              High dietary salt intake is a risk factor for cardiovascular disease. Given the rise in processed <b>food</b> consumption, children in devel …
            </div>
          </div>
        
      </div>
      
        



  <div class="result-actions-bar bottom-bar">


  <div class="cite dropdown-block">
    
    <button class="cite-search-result trigger result-action-trigger citation-dialog-trigger" aria-haspopup="true" data-ga-category="save_share" data-ga-action="cite" data-ga-label="open" data-all-citations-url="/28818842/citations/" data-citation-style="nlm" data-pubmed-format-link="/28818842/export/" aria-expanded="false">
      Cite
    </button>
  </div>


  <div class="in-clipboard-label" hidden="hidden">
  Item in Clipboard
</div>


  </div>


      
    </div>
  </article>


    
  
    
      




  <article class="full-docsum" data-rel-pos="9">
    


<div class="item-selector-wrap selectors-and-actions">
  <input class="search-result-selector" type="checkbox" name="search-result-selector-39067698" id="select-39067698" value="39067698" aria-labelledby="result-selector-label">
  
  <label class="search-result-position" for="select-39067698"><span class="position-number">19</span></label>
  

  
    



  <div class="result-actions-bar side-bar">


  <div class="cite dropdown-block">
    
    <button class="cite-search-result trigger result-action-trigger citation-dialog-trigger" aria-haspopup="true" data-ga-category="save_share" data-ga-action="cite" data-ga-label="open" data-all-citations-url="/39067698/citations/" data-citation-style="nlm" data-pubmed-format-link="/39067698/export/" aria-expanded="false">
      Cite
    </button>
  </div>



  </div>


  
</div>

    <div class="docsum-wrap">
      <div class="docsum-content">
        
          
            
            
            <a class="docsum-title" href="/39067698/" ref="linksrc=docsum_link&amp;article_id=39067698&amp;ordinalpos=9&amp;page=2" data-ga-category="result_click" data-ga-action="19" data-ga-label="39067698" data-full-article-url="from_term=%28hypertension%5BTitle%5D%29+AND+%28food%5BText+Word%5D%29+&amp;from_page=2&amp;from_pos=9" data-article-id="39067698">
              
                Dairy products and <b>hypertension</b>: Cross-sectional and prospective associations.
              
            </a><span class="easyScholarPaperFlag" paperid="42731"> </span>
            <div class="docsum-citation full-citation">
  
    
      
        <span class="docsum-authors full-authors">Farinha VO, Vaucher J, Vidal PM.</span>
        
      
    
    <span class="docsum-authors short-authors">Farinha VO, et al.</span>
    <span class="docsum-journal-citation full-journal-citation">Clin Nutr ESPEN. 2024 Oct;63:597-603. doi: 10.1016/j.clnesp.2024.07.020. Epub 2024 Jul 26.<a class="easyScholarDOI" target="_blank" href="https://www.sci-hub.vg/10.1016/j.clnesp.2024.07.020"><svg version="1.1" id="Layer_1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" x="0px" y="0px" width="22px" height="22px" viewBox="0 0 32 32" enable-background="new 0 0 32 32" xml:space="preserve">  <image id="image0" width="32" height="32" x="0" y="0" href="data:image/png;base64,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"></image></svg></a></span>
    <span class="docsum-journal-citation short-journal-citation">Clin Nutr ESPEN. 2024.</span>
  
  
  
  <span class="citation-part">PMID: <span class="docsum-pmid">39067698</span></span>
  <span class="free-resources spaced-citation-item citation-part">Free article.</span>
  
    
  
  
  
  
  
</div>

          
        
        
          <div class="docsum-snippet">
            <div class="full-view-snippet">
              Dietary intake was assessed via a validated <b>food</b> frequency questionnaire. Dairy consumption was compared between participants with and without prevalent or incident hypertension. ...
            </div>
            <div class="short-view-snippet">
              Dietary intake was assessed via a validated <b>food</b> frequency questionnaire. Dairy consumption was compared between participants with an …
            </div>
          </div>
        
      </div>
      
        



  <div class="result-actions-bar bottom-bar">


  <div class="cite dropdown-block">
    
    <button class="cite-search-result trigger result-action-trigger citation-dialog-trigger" aria-haspopup="true" data-ga-category="save_share" data-ga-action="cite" data-ga-label="open" data-all-citations-url="/39067698/citations/" data-citation-style="nlm" data-pubmed-format-link="/39067698/export/" aria-expanded="false">
      Cite
    </button>
  </div>


  <div class="in-clipboard-label" hidden="hidden">
  Item in Clipboard
</div>


  </div>


      
    </div>
  </article>


    
  
    
      




  <article class="full-docsum" data-rel-pos="10">
    


<div class="item-selector-wrap selectors-and-actions">
  <input class="search-result-selector" type="checkbox" name="search-result-selector-23627503" id="select-23627503" value="23627503" aria-labelledby="result-selector-label">
  
  <label class="search-result-position" for="select-23627503"><span class="position-number">20</span></label>
  

  
    



  <div class="result-actions-bar side-bar">


  <div class="cite dropdown-block">
    
    <button class="cite-search-result trigger result-action-trigger citation-dialog-trigger" aria-haspopup="true" data-ga-category="save_share" data-ga-action="cite" data-ga-label="open" data-all-citations-url="/23627503/citations/" data-citation-style="nlm" data-pubmed-format-link="/23627503/export/" aria-expanded="false">
      Cite
    </button>
  </div>



  </div>


  
</div>

    <div class="docsum-wrap">
      <div class="docsum-content">
        
          
            
            
            <a class="docsum-title" href="/23627503/" ref="linksrc=docsum_link&amp;article_id=23627503&amp;ordinalpos=10&amp;page=2" data-ga-category="result_click" data-ga-action="20" data-ga-label="23627503" data-full-article-url="from_term=%28hypertension%5BTitle%5D%29+AND+%28food%5BText+Word%5D%29+&amp;from_page=2&amp;from_pos=10" data-article-id="23627503">
              
                Bioactive natural constituents from <b>food</b> sources-potential use in <b>hypertension</b> prevention and treatment.
              
            </a><span class="easyScholarPaperFlag" paperid="13927"> </span>
            <div class="docsum-citation full-citation">
  
    
      
        <span class="docsum-authors full-authors">Huang WY, Davidge ST, Wu J.</span>
        
      
    
    <span class="docsum-authors short-authors">Huang WY, et al.</span>
    <span class="docsum-journal-citation full-journal-citation">Crit Rev Food Sci Nutr. 2013;53(6):615-30. doi: 10.1080/10408398.2010.550071.<a class="easyScholarDOI" target="_blank" href="https://www.sci-hub.vg/10.1080/10408398.2010.550071"><svg version="1.1" id="Layer_1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" x="0px" y="0px" width="22px" height="22px" viewBox="0 0 32 32" enable-background="new 0 0 32 32" xml:space="preserve">  <image id="image0" width="32" height="32" x="0" y="0" href="data:image/png;base64,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"></image></svg></a></span>
    <span class="docsum-journal-citation short-journal-citation">Crit Rev Food Sci Nutr. 2013.</span>
  
  
  
  <span class="citation-part">PMID: <span class="docsum-pmid">23627503</span></span>
  
  
    
  
  <span class="publication-type spaced-citation-item citation-part">Review.</span>
  
  
  
</div>

          
        
        
          <div class="docsum-snippet">
            <div class="full-view-snippet">
              Grain, vegetables, fruits, milk, cheese, meat, chicken, egg, fish, soybean, tea, wine, mushrooms, and lactic acid bacteria are various <b>food</b> sources with potential antihypertensive effects. Their main bioactive constituents include angiotensin I-converting enzyme (ACE) inhi …
            </div>
            <div class="short-view-snippet">
              Grain, vegetables, fruits, milk, cheese, meat, chicken, egg, fish, soybean, tea, wine, mushrooms, and lactic acid bacteria are various <b>fo</b> …
            </div>
          </div>
        
      </div>
      
        



  <div class="result-actions-bar bottom-bar">


  <div class="cite dropdown-block">
    
    <button class="cite-search-result trigger result-action-trigger citation-dialog-trigger" aria-haspopup="true" data-ga-category="save_share" data-ga-action="cite" data-ga-label="open" data-all-citations-url="/23627503/citations/" data-citation-style="nlm" data-pubmed-format-link="/23627503/export/" aria-expanded="false">
      Cite
    </button>
  </div>


  <div class="in-clipboard-label" hidden="hidden">
  Item in Clipboard
</div>


  </div>


      
    </div>
  </article>


    
  
  <div class="cite dropdown-block dropdown-block-container">
  <div class="dropdown cite-dropdown dropdown-container" aria-hidden="true">
    <div class="title">
      Cite
    </div>
    <div class="content">
      <div class="citation-text-block">
  <div class="citation-text"></div>
  <div class="citation-actions">
    <button class="copy-button dialog-focus" data-ga-category="save_share" data-ga-action="cite" data-ga-label="copy">
      Copy
    </button>

    <form method="post">
      <input type="hidden" name="csrfmiddlewaretoken" value="sXcYXzaFLKFHRX0o0yUeKm8kYyZpxgiSZsGy4hvUQ650c0B9IvSjrwtOec8h6uM9">
      <button type="submit" class="export-button" data-ga-category="save_share" data-ga-action="cite" data-ga-label="download" title="Download a file for external citation management software">
        <span class="download-title">Download .nbib</span>
        <span class="download-title-mobile">.nbib</span>
      </button>
    </form>

    


<div class="citation-style-selector-wrapper">
  <label class="selector-label">Format:</label>
  <select aria-label="Format" class="citation-style-selector">
    
      <option data-style-url-name="ama" value="AMA">
        AMA
      </option>
    
      <option data-style-url-name="apa" value="APA">
        APA
      </option>
    
      <option data-style-url-name="mla" value="MLA">
        MLA
      </option>
    
      <option data-style-url-name="nlm" value="NLM" selected="selected">
        NLM
      </option>
    
  </select>
</div>

  </div>
<div class="dots-loading-indicator citation-loading-indicator">
        <div class="dot dot-1"></div>
        <div class="dot dot-2"></div>
        <div class="dot dot-3"></div>
      </div></div>

    </div>
  </div>
</div>
</div>

      <!-- More chunks will be added dynamically -->
    </div>

    
      <div class="search-results-paginator next-results-paginator has-nav">
  
  

<div class="results-amount">
  
    
      <span class="value">1,827</span>
      results
    
  
</div>

  
    <button class="load-button next-page" ref="linksrc=show_more_btn" data-ga-category="pagination" data-ga-action="show_more" data-ga-label="Show_more_results" data-last-page="183">
      <span class="text">Show more results</span>
    <div class="dots-loading-indicator page-loading-indicator">
        <div class="dot dot-1" style="background-color: white;"></div>
        <div class="dot dot-2" style="background-color: white;"></div>
        <div class="dot dot-3" style="background-color: white;"></div>
      </div></button>
  
  
</div>

    
  
  <div class="overlay" role="dialog" aria-label="Citation Dialog">
  <div class="dialog citation-dialog">
    <button class="close-overlay" tabindex="1">[x]</button>
    <div class="title">Cite</div>
    <div class="citation-text-block">
  <div class="citation-text"></div>
  <div class="citation-actions">
    <button class="copy-button dialog-focus" data-ga-category="save_share" data-ga-action="cite" data-ga-label="copy" tabindex="2">
      Copy
    </button>

    <form method="post">
      <input type="hidden" name="csrfmiddlewaretoken" value="sXcYXzaFLKFHRX0o0yUeKm8kYyZpxgiSZsGy4hvUQ650c0B9IvSjrwtOec8h6uM9">
      <button type="submit" class="export-button" data-ga-category="save_share" data-ga-action="cite" data-ga-label="download" title="Download a file for external citation management software" tabindex="3">
        <span class="download-title">Download .nbib</span>
        <span class="download-title-mobile">.nbib</span>
      </button>
    </form>

    


<div class="citation-style-selector-wrapper">
  <label class="selector-label">Format:</label>
  <select aria-label="Format" class="citation-style-selector" tabindex="4">
    
      <option data-style-url-name="ama" value="AMA">
        AMA
      </option>
    
      <option data-style-url-name="apa" value="APA">
        APA
      </option>
    
      <option data-style-url-name="mla" value="MLA">
        MLA
      </option>
    
      <option data-style-url-name="nlm" value="NLM" selected="selected">
        NLM
      </option>
    
  </select>
</div>

  </div>
</div>

  </div>
</div>

<div class="dots-loading-indicator loading-indicator">
        <div class="dot dot-1"></div>
        <div class="dot dot-2"></div>
        <div class="dot dot-3"></div>
      </div></section>

  <div class="bottom-pagination">
    
      


<button class="button-wrapper first-page-btn" title="Navigate directly to the first page of results." data-ga-category="pagination" data-ga-action="Results_nav" data-ga-label="First_page_arrow_bottom" aria-label="Navigates to the first page of results.">
  <img src="https://cdn.ncbi.nlm.nih.gov/pubmed/6aa07a65-6caa-4bbc-acaa-48623b669c29/core/images/double-chevron-left-thin-blue.svg" class="chevron-icon enabled-icon" alt="first page">
  <img src="https://cdn.ncbi.nlm.nih.gov/pubmed/6aa07a65-6caa-4bbc-acaa-48623b669c29/core/images/double-chevron-left-thin-grey.svg" class="chevron-icon disabled-icon" alt="first page">
  
    <label>First</label>
  
</button>

<button class="button-wrapper prev-page-btn" title="Navigate to the previous page of results." data-ga-category="pagination" data-ga-action="Results_nav" data-ga-label="Prev_page_arrow_bottom" aria-label="Navigates to the previous page of results.">
  <img src="https://cdn.ncbi.nlm.nih.gov/pubmed/6aa07a65-6caa-4bbc-acaa-48623b669c29/core/images/chevron-left-thin-blue.svg" class="chevron-icon enabled-icon" alt="previous page">
  <img src="https://cdn.ncbi.nlm.nih.gov/pubmed/6aa07a65-6caa-4bbc-acaa-48623b669c29/core/images/chevron-left-thin-grey.svg" class="chevron-icon disabled-icon" alt="previous page">
  
    <label>Prev</label>
  
</button>

<div class="page-number-wrapper">
  <label for="bottom-page-number-input">Page</label>
  <form class="page-number-form">
    <input class="page-number" id="bottom-page-number-input" aria-label="page number input" title="Press Enter to navigate to the page number." type="number" min="1" max="183" data-ga-category="pagination" data-ga-action="Jump_to_page_bottom" value="2">
  </form>
  <label class="of-total-pages">of 183</label>
</div>

<button class="button-wrapper next-page-btn" title="Navigate to the next page of results." data-ga-category="pagination" data-ga-action="Results_nav" data-ga-label="Next_page_arrow_bottom" aria-label="Navigates to the next page of results.">
  
    <label>Next</label>
  
  <img src="https://cdn.ncbi.nlm.nih.gov/pubmed/6aa07a65-6caa-4bbc-acaa-48623b669c29/core/images/chevron-right-thin-blue.svg" class="chevron-icon enabled-icon" alt="next page">
  <img src="https://cdn.ncbi.nlm.nih.gov/pubmed/6aa07a65-6caa-4bbc-acaa-48623b669c29/core/images/chevron-right-thin-grey.svg" class="chevron-icon disabled-icon" alt="next page">
</button>

<button class="button-wrapper last-page-btn" title="Navigate directly to the last page of results." aria-label="Navigates to the last page of results." data-ga-category="pagination" data-ga-action="Results_nav" data-ga-label="Last_page_arrow_bottom" data-max-page="183">
  
    <label>Last</label>
  
  <img src="https://cdn.ncbi.nlm.nih.gov/pubmed/6aa07a65-6caa-4bbc-acaa-48623b669c29/core/images/double-chevron-right-thin-blue.svg" class="chevron-icon enabled-icon" alt="last page">
  <img src="https://cdn.ncbi.nlm.nih.gov/pubmed/6aa07a65-6caa-4bbc-acaa-48623b669c29/core/images/double-chevron-right-thin-grey.svg" class="chevron-icon disabled-icon" alt="last page">
</button>
    
  </div>
  
</div>

    </div>

    <div class="overlay" role="dialog" aria-label="More Actions Dialog">
  <div id="more-actions-dialog" class="dialog more-actions-dialog" role="document">
    <strong class="title">Send To</strong>
    <ul class="more-actions-links">
      
        <li><a id="clipboard-trigger" role="button" class="submit-button clipboard-trigger clipboard-trigger-target dialog-focus link-item " href="#">Clipboard</a></li>
      
      <li><a class="link-item" role="button" href="https://account.ncbi.nlm.nih.gov/?back_url=https%3A%2F%2Fpubmed.ncbi.nlm.nih.gov%2F%3Fterm%3D%28hypertension%255BTitle%255D%29%2520AND%2520%28food%255BText%2520Word%255D%29%2520%26page%3D2%23open-email-panel">Email</a></li>
      <li><a class="save-trigger link-item" role="button" href="#">Save</a></li>
      
        <li><a class="link-item" role="button" href="https://account.ncbi.nlm.nih.gov/?back_url=https%3A%2F%2Fpubmed.ncbi.nlm.nih.gov%2F%3Fterm%3D%28hypertension%255BTitle%255D%29%2520AND%2520%28food%255BText%2520Word%255D%29%2520%26page%3D2%23open-bibliography-panel">My Bibliography</a></li>
        <li><a class="link-item" role="button" href="https://account.ncbi.nlm.nih.gov/?back_url=https%3A%2F%2Fpubmed.ncbi.nlm.nih.gov%2F%3Fterm%3D%28hypertension%255BTitle%255D%29%2520AND%2520%28food%255BText%2520Word%255D%29%2520%26page%3D2%23open-collections-panel">Collections</a></li>
      
      <li><a class="citation-manager-trigger link-item" role="button" href="#">Citation Manager</a></li>
    </ul>
    <button class="close-overlay" data-pinger-ignore="true">[x]</button>
  </div>
</div>

    


  

  

  

  
    <div class="overlay" role="dialog" aria-label="Article Type Filters">
      <div class="dialog customize-article-type-filters-dialog" role="document">
        <div class="title title-pubt">ARTICLE TYPE</div>
        <div role="group" aria-labelledby="title-pubt" class="custom-filters-checkbox-container" id="panel-pubt">
          <ul class="choice-group-items items-pubt">
            
              
                
                  <li>
                    <input aria-checked="false" type="checkbox" name="custom-filter" id="id_custom_filter_pubt.adaptiveclinicaltrial" value="pubt.adaptiveclinicaltrial">
                    <label for="id_custom_filter_pubt.adaptiveclinicaltrial" class="choice-group-item-title-text">
                      Adaptive Clinical Trial
                    </label>
                  </li>
                
              
            
              
                
                  <li>
                    <input aria-checked="false" type="checkbox" name="custom-filter" id="id_custom_filter_pubt.address" value="pubt.address">
                    <label for="id_custom_filter_pubt.address" class="choice-group-item-title-text">
                      Address
                    </label>
                  </li>
                
              
            
              
                
                  <li>
                    <input aria-checked="false" type="checkbox" name="custom-filter" id="id_custom_filter_pubt.autobiography" value="pubt.autobiography">
                    <label for="id_custom_filter_pubt.autobiography" class="choice-group-item-title-text">
                      Autobiography
                    </label>
                  </li>
                
              
            
              
                
                  <li>
                    <input aria-checked="false" type="checkbox" name="custom-filter" id="id_custom_filter_pubt.bibliography" value="pubt.bibliography">
                    <label for="id_custom_filter_pubt.bibliography" class="choice-group-item-title-text">
                      Bibliography
                    </label>
                  </li>
                
              
            
              
                
                  <li>
                    <input aria-checked="false" type="checkbox" name="custom-filter" id="id_custom_filter_pubt.biography" value="pubt.biography">
                    <label for="id_custom_filter_pubt.biography" class="choice-group-item-title-text">
                      Biography
                    </label>
                  </li>
                
              
            
              
                
                  <li>
                    <input aria-checked="false" type="checkbox" name="custom-filter" id="id_custom_filter_pubt.booksdocs" value="pubt.booksdocs">
                    <label for="id_custom_filter_pubt.booksdocs" class="choice-group-item-title-text">
                      Books and Documents
                    </label>
                  </li>
                
              
            
              
                
                  <li>
                    <input aria-checked="false" type="checkbox" name="custom-filter" id="id_custom_filter_pubt.casereports" value="pubt.casereports">
                    <label for="id_custom_filter_pubt.casereports" class="choice-group-item-title-text">
                      Case Reports
                    </label>
                  </li>
                
              
            
              
                
                  <li>
                    <input aria-checked="false" type="checkbox" name="custom-filter" id="id_custom_filter_pubt.classicalarticle" value="pubt.classicalarticle">
                    <label for="id_custom_filter_pubt.classicalarticle" class="choice-group-item-title-text">
                      Classical Article
                    </label>
                  </li>
                
              
            
              
                
                  <li>
                    <input aria-checked="false" type="checkbox" name="custom-filter" id="id_custom_filter_pubt.clinicalconference" value="pubt.clinicalconference">
                    <label for="id_custom_filter_pubt.clinicalconference" class="choice-group-item-title-text">
                      Clinical Conference
                    </label>
                  </li>
                
              
            
              
                
                  <li>
                    <input aria-checked="false" type="checkbox" name="custom-filter" id="id_custom_filter_pubt.clinicalstudy" value="pubt.clinicalstudy">
                    <label for="id_custom_filter_pubt.clinicalstudy" class="choice-group-item-title-text">
                      Clinical Study
                    </label>
                  </li>
                
              
            
              
                
                  <li>
                    <input aria-checked="false" type="checkbox" name="custom-filter" id="id_custom_filter_pubt.clinicaltrial" value="pubt.clinicaltrial">
                    <label for="id_custom_filter_pubt.clinicaltrial" class="choice-group-item-title-text">
                      Clinical Trial
                    </label>
                  </li>
                
              
            
              
                
                  <li>
                    <input aria-checked="false" type="checkbox" name="custom-filter" id="id_custom_filter_pubt.clinicaltrialprotocol" value="pubt.clinicaltrialprotocol">
                    <label for="id_custom_filter_pubt.clinicaltrialprotocol" class="choice-group-item-title-text">
                      Clinical Trial Protocol
                    </label>
                  </li>
                
              
            
              
                
                  <li>
                    <input aria-checked="false" type="checkbox" name="custom-filter" id="id_custom_filter_pubt.clinicaltrialphasei" value="pubt.clinicaltrialphasei">
                    <label for="id_custom_filter_pubt.clinicaltrialphasei" class="choice-group-item-title-text">
                      Clinical Trial, Phase I
                    </label>
                  </li>
                
              
            
              
                
                  <li>
                    <input aria-checked="false" type="checkbox" name="custom-filter" id="id_custom_filter_pubt.clinicaltrialphaseii" value="pubt.clinicaltrialphaseii">
                    <label for="id_custom_filter_pubt.clinicaltrialphaseii" class="choice-group-item-title-text">
                      Clinical Trial, Phase II
                    </label>
                  </li>
                
              
            
              
                
                  <li>
                    <input aria-checked="false" type="checkbox" name="custom-filter" id="id_custom_filter_pubt.clinicaltrialphaseiii" value="pubt.clinicaltrialphaseiii">
                    <label for="id_custom_filter_pubt.clinicaltrialphaseiii" class="choice-group-item-title-text">
                      Clinical Trial, Phase III
                    </label>
                  </li>
                
              
            
              
                
                  <li>
                    <input aria-checked="false" type="checkbox" name="custom-filter" id="id_custom_filter_pubt.clinicaltrialphaseiv" value="pubt.clinicaltrialphaseiv">
                    <label for="id_custom_filter_pubt.clinicaltrialphaseiv" class="choice-group-item-title-text">
                      Clinical Trial, Phase IV
                    </label>
                  </li>
                
              
            
              
                
                  <li>
                    <input aria-checked="false" type="checkbox" name="custom-filter" id="id_custom_filter_pubt.veterinaryclinicaltrial" value="pubt.veterinaryclinicaltrial">
                    <label for="id_custom_filter_pubt.veterinaryclinicaltrial" class="choice-group-item-title-text">
                      Clinical Trial, Veterinary
                    </label>
                  </li>
                
              
            
              
                
                  <li>
                    <input aria-checked="false" type="checkbox" name="custom-filter" id="id_custom_filter_pubt.collectedwork" value="pubt.collectedwork">
                    <label for="id_custom_filter_pubt.collectedwork" class="choice-group-item-title-text">
                      Collected Work
                    </label>
                  </li>
                
              
            
              
                
                  <li>
                    <input aria-checked="false" type="checkbox" name="custom-filter" id="id_custom_filter_pubt.comment" value="pubt.comment">
                    <label for="id_custom_filter_pubt.comment" class="choice-group-item-title-text">
                      Comment
                    </label>
                  </li>
                
              
            
              
                
                  <li>
                    <input aria-checked="false" type="checkbox" name="custom-filter" id="id_custom_filter_pubt.comparativestudy" value="pubt.comparativestudy">
                    <label for="id_custom_filter_pubt.comparativestudy" class="choice-group-item-title-text">
                      Comparative Study
                    </label>
                  </li>
                
              
            
              
                
                  <li>
                    <input aria-checked="false" type="checkbox" name="custom-filter" id="id_custom_filter_pubt.congress" value="pubt.congress">
                    <label for="id_custom_filter_pubt.congress" class="choice-group-item-title-text">
                      Congress
                    </label>
                  </li>
                
              
            
              
                
                  <li>
                    <input aria-checked="false" type="checkbox" name="custom-filter" id="id_custom_filter_pubt.consensusdevelopmentconference" value="pubt.consensusdevelopmentconference">
                    <label for="id_custom_filter_pubt.consensusdevelopmentconference" class="choice-group-item-title-text">
                      Consensus Development Conference
                    </label>
                  </li>
                
              
            
              
                
                  <li>
                    <input aria-checked="false" type="checkbox" name="custom-filter" id="id_custom_filter_pubt.consensusdevelopmentconferencenih" value="pubt.consensusdevelopmentconferencenih">
                    <label for="id_custom_filter_pubt.consensusdevelopmentconferencenih" class="choice-group-item-title-text">
                      Consensus Development Conference, NIH
                    </label>
                  </li>
                
              
            
              
                
                  <li>
                    <input aria-checked="false" type="checkbox" name="custom-filter" id="id_custom_filter_pubt.controlledclinicaltrial" value="pubt.controlledclinicaltrial">
                    <label for="id_custom_filter_pubt.controlledclinicaltrial" class="choice-group-item-title-text">
                      Controlled Clinical Trial
                    </label>
                  </li>
                
              
            
              
                
                  <li>
                    <input aria-checked="false" type="checkbox" name="custom-filter" id="id_custom_filter_pubt.correctedandrepublishedarticle" value="pubt.correctedandrepublishedarticle">
                    <label for="id_custom_filter_pubt.correctedandrepublishedarticle" class="choice-group-item-title-text">
                      Corrected and Republished Article
                    </label>
                  </li>
                
              
            
              
                
                  <li>
                    <input aria-checked="false" type="checkbox" name="custom-filter" id="id_custom_filter_pubt.dataset" value="pubt.dataset">
                    <label for="id_custom_filter_pubt.dataset" class="choice-group-item-title-text">
                      Dataset
                    </label>
                  </li>
                
              
            
              
                
                  <li>
                    <input aria-checked="false" type="checkbox" name="custom-filter" id="id_custom_filter_pubt.dictionary" value="pubt.dictionary">
                    <label for="id_custom_filter_pubt.dictionary" class="choice-group-item-title-text">
                      Dictionary
                    </label>
                  </li>
                
              
            
              
                
                  <li>
                    <input aria-checked="false" type="checkbox" name="custom-filter" id="id_custom_filter_pubt.directory" value="pubt.directory">
                    <label for="id_custom_filter_pubt.directory" class="choice-group-item-title-text">
                      Directory
                    </label>
                  </li>
                
              
            
              
                
                  <li>
                    <input aria-checked="false" type="checkbox" name="custom-filter" id="id_custom_filter_pubt.duplicatepublication" value="pubt.duplicatepublication">
                    <label for="id_custom_filter_pubt.duplicatepublication" class="choice-group-item-title-text">
                      Duplicate Publication
                    </label>
                  </li>
                
              
            
              
                
                  <li>
                    <input aria-checked="false" type="checkbox" name="custom-filter" id="id_custom_filter_pubt.editorial" value="pubt.editorial">
                    <label for="id_custom_filter_pubt.editorial" class="choice-group-item-title-text">
                      Editorial
                    </label>
                  </li>
                
              
            
              
                
                  <li>
                    <input aria-checked="false" type="checkbox" name="custom-filter" id="id_custom_filter_pubt.electronicsupplementarymaterials" value="pubt.electronicsupplementarymaterials">
                    <label for="id_custom_filter_pubt.electronicsupplementarymaterials" class="choice-group-item-title-text">
                      Electronic Supplementary Materials
                    </label>
                  </li>
                
              
            
              
                
                  <li>
                    <input aria-checked="false" type="checkbox" name="custom-filter" id="id_custom_filter_pubt.englishabstract" value="pubt.englishabstract">
                    <label for="id_custom_filter_pubt.englishabstract" class="choice-group-item-title-text">
                      English Abstract
                    </label>
                  </li>
                
              
            
              
                
                  <li>
                    <input aria-checked="false" type="checkbox" name="custom-filter" id="id_custom_filter_pubt.equivalencetrial" value="pubt.equivalencetrial">
                    <label for="id_custom_filter_pubt.equivalencetrial" class="choice-group-item-title-text">
                      Equivalence Trial
                    </label>
                  </li>
                
              
            
              
                
                  <li>
                    <input aria-checked="false" type="checkbox" name="custom-filter" id="id_custom_filter_pubt.evaluationstudy" value="pubt.evaluationstudy">
                    <label for="id_custom_filter_pubt.evaluationstudy" class="choice-group-item-title-text">
                      Evaluation Study
                    </label>
                  </li>
                
              
            
              
                
                  <li>
                    <input aria-checked="false" type="checkbox" name="custom-filter" id="id_custom_filter_pubt.expressionofconcern" value="pubt.expressionofconcern">
                    <label for="id_custom_filter_pubt.expressionofconcern" class="choice-group-item-title-text">
                      Expression of Concern
                    </label>
                  </li>
                
              
            
              
                
                  <li>
                    <input aria-checked="false" type="checkbox" name="custom-filter" id="id_custom_filter_pubt.festschrift" value="pubt.festschrift">
                    <label for="id_custom_filter_pubt.festschrift" class="choice-group-item-title-text">
                      Festschrift
                    </label>
                  </li>
                
              
            
              
                
                  <li>
                    <input aria-checked="false" type="checkbox" name="custom-filter" id="id_custom_filter_pubt.governmentpublication" value="pubt.governmentpublication">
                    <label for="id_custom_filter_pubt.governmentpublication" class="choice-group-item-title-text">
                      Government Publication
                    </label>
                  </li>
                
              
            
              
                
                  <li>
                    <input aria-checked="false" type="checkbox" name="custom-filter" id="id_custom_filter_pubt.guideline" value="pubt.guideline">
                    <label for="id_custom_filter_pubt.guideline" class="choice-group-item-title-text">
                      Guideline
                    </label>
                  </li>
                
              
            
              
                
                  <li>
                    <input aria-checked="false" type="checkbox" name="custom-filter" id="id_custom_filter_pubt.historicalarticle" value="pubt.historicalarticle">
                    <label for="id_custom_filter_pubt.historicalarticle" class="choice-group-item-title-text">
                      Historical Article
                    </label>
                  </li>
                
              
            
              
                
                  <li>
                    <input aria-checked="false" type="checkbox" name="custom-filter" id="id_custom_filter_pubt.interactivetutorial" value="pubt.interactivetutorial">
                    <label for="id_custom_filter_pubt.interactivetutorial" class="choice-group-item-title-text">
                      Interactive Tutorial
                    </label>
                  </li>
                
              
            
              
                
                  <li>
                    <input aria-checked="false" type="checkbox" name="custom-filter" id="id_custom_filter_pubt.interview" value="pubt.interview">
                    <label for="id_custom_filter_pubt.interview" class="choice-group-item-title-text">
                      Interview
                    </label>
                  </li>
                
              
            
              
                
                  <li>
                    <input aria-checked="false" type="checkbox" name="custom-filter" id="id_custom_filter_pubt.introductoryjournalarticle" value="pubt.introductoryjournalarticle">
                    <label for="id_custom_filter_pubt.introductoryjournalarticle" class="choice-group-item-title-text">
                      Introductory Journal Article
                    </label>
                  </li>
                
              
            
              
                
                  <li>
                    <input aria-checked="false" type="checkbox" name="custom-filter" id="id_custom_filter_pubt.lecture" value="pubt.lecture">
                    <label for="id_custom_filter_pubt.lecture" class="choice-group-item-title-text">
                      Lecture
                    </label>
                  </li>
                
              
            
              
                
                  <li>
                    <input aria-checked="false" type="checkbox" name="custom-filter" id="id_custom_filter_pubt.legalcase" value="pubt.legalcase">
                    <label for="id_custom_filter_pubt.legalcase" class="choice-group-item-title-text">
                      Legal Case
                    </label>
                  </li>
                
              
            
              
                
                  <li>
                    <input aria-checked="false" type="checkbox" name="custom-filter" id="id_custom_filter_pubt.legislation" value="pubt.legislation">
                    <label for="id_custom_filter_pubt.legislation" class="choice-group-item-title-text">
                      Legislation
                    </label>
                  </li>
                
              
            
              
                
                  <li>
                    <input aria-checked="false" type="checkbox" name="custom-filter" id="id_custom_filter_pubt.letter" value="pubt.letter">
                    <label for="id_custom_filter_pubt.letter" class="choice-group-item-title-text">
                      Letter
                    </label>
                  </li>
                
              
            
              
                
                  <li>
                    <input aria-checked="false" type="checkbox" name="custom-filter" id="id_custom_filter_pubt.meta-analysis" value="pubt.meta-analysis">
                    <label for="id_custom_filter_pubt.meta-analysis" class="choice-group-item-title-text">
                      Meta-Analysis
                    </label>
                  </li>
                
              
            
              
                
                  <li>
                    <input aria-checked="false" type="checkbox" name="custom-filter" id="id_custom_filter_pubt.multicenterstudy" value="pubt.multicenterstudy">
                    <label for="id_custom_filter_pubt.multicenterstudy" class="choice-group-item-title-text">
                      Multicenter Study
                    </label>
                  </li>
                
              
            
              
                
                  <li>
                    <input aria-checked="false" type="checkbox" name="custom-filter" id="id_custom_filter_pubt.networkmetaanalysis" value="pubt.networkmetaanalysis">
                    <label for="id_custom_filter_pubt.networkmetaanalysis" class="choice-group-item-title-text">
                      Network Meta-Analysis
                    </label>
                  </li>
                
              
            
              
                
                  <li>
                    <input aria-checked="false" type="checkbox" name="custom-filter" id="id_custom_filter_pubt.news" value="pubt.news">
                    <label for="id_custom_filter_pubt.news" class="choice-group-item-title-text">
                      News
                    </label>
                  </li>
                
              
            
              
                
                  <li>
                    <input aria-checked="false" type="checkbox" name="custom-filter" id="id_custom_filter_pubt.newspaperarticle" value="pubt.newspaperarticle">
                    <label for="id_custom_filter_pubt.newspaperarticle" class="choice-group-item-title-text">
                      Newspaper Article
                    </label>
                  </li>
                
              
            
              
                
                  <li>
                    <input aria-checked="false" type="checkbox" name="custom-filter" id="id_custom_filter_pubt.observationalstudy" value="pubt.observationalstudy">
                    <label for="id_custom_filter_pubt.observationalstudy" class="choice-group-item-title-text">
                      Observational Study
                    </label>
                  </li>
                
              
            
              
                
                  <li>
                    <input aria-checked="false" type="checkbox" name="custom-filter" id="id_custom_filter_pubt.veterinaryobservationalstudy" value="pubt.veterinaryobservationalstudy">
                    <label for="id_custom_filter_pubt.veterinaryobservationalstudy" class="choice-group-item-title-text">
                      Observational Study, Veterinary
                    </label>
                  </li>
                
              
            
              
                
                  <li>
                    <input aria-checked="false" type="checkbox" name="custom-filter" id="id_custom_filter_pubt.overall" value="pubt.overall">
                    <label for="id_custom_filter_pubt.overall" class="choice-group-item-title-text">
                      Overall
                    </label>
                  </li>
                
              
            
              
                
                  <li>
                    <input aria-checked="false" type="checkbox" name="custom-filter" id="id_custom_filter_pubt.patienteducationhandout" value="pubt.patienteducationhandout">
                    <label for="id_custom_filter_pubt.patienteducationhandout" class="choice-group-item-title-text">
                      Patient Education Handout
                    </label>
                  </li>
                
              
            
              
                
                  <li>
                    <input aria-checked="false" type="checkbox" name="custom-filter" id="id_custom_filter_pubt.periodicalindex" value="pubt.periodicalindex">
                    <label for="id_custom_filter_pubt.periodicalindex" class="choice-group-item-title-text">
                      Periodical Index
                    </label>
                  </li>
                
              
            
              
                
                  <li>
                    <input aria-checked="false" type="checkbox" name="custom-filter" id="id_custom_filter_pubt.personalnarrative" value="pubt.personalnarrative">
                    <label for="id_custom_filter_pubt.personalnarrative" class="choice-group-item-title-text">
                      Personal Narrative
                    </label>
                  </li>
                
              
            
              
                
                  <li>
                    <input aria-checked="false" type="checkbox" name="custom-filter" id="id_custom_filter_pubt.portrait" value="pubt.portrait">
                    <label for="id_custom_filter_pubt.portrait" class="choice-group-item-title-text">
                      Portrait
                    </label>
                  </li>
                
              
            
              
                
                  <li>
                    <input aria-checked="false" type="checkbox" name="custom-filter" id="id_custom_filter_pubt.practiceguideline" value="pubt.practiceguideline">
                    <label for="id_custom_filter_pubt.practiceguideline" class="choice-group-item-title-text">
                      Practice Guideline
                    </label>
                  </li>
                
              
            
              
                
                  <li>
                    <input aria-checked="false" type="checkbox" name="custom-filter" id="id_custom_filter_pubt.pragmaticclinicaltrial" value="pubt.pragmaticclinicaltrial">
                    <label for="id_custom_filter_pubt.pragmaticclinicaltrial" class="choice-group-item-title-text">
                      Pragmatic Clinical Trial
                    </label>
                  </li>
                
              
            
              
                
                  <li>
                    <input aria-checked="false" type="checkbox" name="custom-filter" id="id_custom_filter_pubt.preprint" value="pubt.preprint">
                    <label for="id_custom_filter_pubt.preprint" class="choice-group-item-title-text">
                      Preprint
                    </label>
                  </li>
                
              
            
              
                
                  <li>
                    <input aria-checked="false" type="checkbox" name="custom-filter" id="id_custom_filter_pubt.publishederratum" value="pubt.publishederratum">
                    <label for="id_custom_filter_pubt.publishederratum" class="choice-group-item-title-text">
                      Published Erratum
                    </label>
                  </li>
                
              
            
              
                
                  <li>
                    <input aria-checked="false" type="checkbox" name="custom-filter" id="id_custom_filter_pubt.randomizedcontrolledtrial" value="pubt.randomizedcontrolledtrial">
                    <label for="id_custom_filter_pubt.randomizedcontrolledtrial" class="choice-group-item-title-text">
                      Randomized Controlled Trial
                    </label>
                  </li>
                
              
            
              
                
                  <li>
                    <input aria-checked="false" type="checkbox" name="custom-filter" id="id_custom_filter_pubt.randomizedcontrolledtrialveterinary" value="pubt.randomizedcontrolledtrialveterinary">
                    <label for="id_custom_filter_pubt.randomizedcontrolledtrialveterinary" class="choice-group-item-title-text">
                      Randomized Controlled Trial, Veterinary
                    </label>
                  </li>
                
              
            
              
                
                  <li>
                    <input aria-checked="false" type="checkbox" name="custom-filter" id="id_custom_filter_pubt.researchsupportamericanrecoveryandreinvestmentact" value="pubt.researchsupportamericanrecoveryandreinvestmentact">
                    <label for="id_custom_filter_pubt.researchsupportamericanrecoveryandreinvestmentact" class="choice-group-item-title-text">
                      Research Support, American Recovery and Reinvestment Act
                    </label>
                  </li>
                
              
            
              
                
                  <li>
                    <input aria-checked="false" type="checkbox" name="custom-filter" id="id_custom_filter_pubt.researchsupportnihextramural" value="pubt.researchsupportnihextramural">
                    <label for="id_custom_filter_pubt.researchsupportnihextramural" class="choice-group-item-title-text">
                      Research Support, N.I.H., Extramural
                    </label>
                  </li>
                
              
            
              
                
                  <li>
                    <input aria-checked="false" type="checkbox" name="custom-filter" id="id_custom_filter_pubt.researchsupportnihintramural" value="pubt.researchsupportnihintramural">
                    <label for="id_custom_filter_pubt.researchsupportnihintramural" class="choice-group-item-title-text">
                      Research Support, N.I.H., Intramural
                    </label>
                  </li>
                
              
            
              
                
                  <li>
                    <input aria-checked="false" type="checkbox" name="custom-filter" id="id_custom_filter_pubt.researchsupportnonusgovt" value="pubt.researchsupportnonusgovt">
                    <label for="id_custom_filter_pubt.researchsupportnonusgovt" class="choice-group-item-title-text">
                      Research Support, Non-U.S. Gov't
                    </label>
                  </li>
                
              
            
              
                
                  <li>
                    <input aria-checked="false" type="checkbox" name="custom-filter" id="id_custom_filter_pubt.researchsupportusgovtnonphs" value="pubt.researchsupportusgovtnonphs">
                    <label for="id_custom_filter_pubt.researchsupportusgovtnonphs" class="choice-group-item-title-text">
                      Research Support, U.S. Gov't, Non-P.H.S.
                    </label>
                  </li>
                
              
            
              
                
                  <li>
                    <input aria-checked="false" type="checkbox" name="custom-filter" id="id_custom_filter_pubt.researchsupportusgovtphs" value="pubt.researchsupportusgovtphs">
                    <label for="id_custom_filter_pubt.researchsupportusgovtphs" class="choice-group-item-title-text">
                      Research Support, U.S. Gov't, P.H.S.
                    </label>
                  </li>
                
              
            
              
                
                  <li>
                    <input aria-checked="false" type="checkbox" name="custom-filter" id="id_custom_filter_pubt.researchsupportusgovernment" value="pubt.researchsupportusgovernment">
                    <label for="id_custom_filter_pubt.researchsupportusgovernment" class="choice-group-item-title-text">
                      Research Support, U.S. Gov't
                    </label>
                  </li>
                
              
            
              
                
                  <li>
                    <input aria-checked="false" type="checkbox" name="custom-filter" id="id_custom_filter_pubt.retractedpublication" value="pubt.retractedpublication">
                    <label for="id_custom_filter_pubt.retractedpublication" class="choice-group-item-title-text">
                      Retracted Publication
                    </label>
                  </li>
                
              
            
              
                
                  <li>
                    <input aria-checked="false" type="checkbox" name="custom-filter" id="id_custom_filter_pubt.retractionofpublication" value="pubt.retractionofpublication">
                    <label for="id_custom_filter_pubt.retractionofpublication" class="choice-group-item-title-text">
                      Retraction of Publication
                    </label>
                  </li>
                
              
            
              
                
                  <li>
                    <input aria-checked="false" type="checkbox" name="custom-filter" id="id_custom_filter_pubt.review" value="pubt.review">
                    <label for="id_custom_filter_pubt.review" class="choice-group-item-title-text">
                      Review
                    </label>
                  </li>
                
              
            
              
                
                  <li>
                    <input aria-checked="false" type="checkbox" name="custom-filter" id="id_custom_filter_pubt.scientificintegrityreview" value="pubt.scientificintegrityreview">
                    <label for="id_custom_filter_pubt.scientificintegrityreview" class="choice-group-item-title-text">
                      Scientific Integrity Review
                    </label>
                  </li>
                
              
            
              
                
                  <li>
                    <input aria-checked="false" type="checkbox" name="custom-filter" id="id_custom_filter_pubt.scopingreview" value="pubt.scopingreview">
                    <label for="id_custom_filter_pubt.scopingreview" class="choice-group-item-title-text">
                      Scoping Review
                    </label>
                  </li>
                
              
            
              
                
                  <li>
                    <input aria-checked="false" type="checkbox" name="custom-filter" id="id_custom_filter_pubt.systematicreview" value="pubt.systematicreview">
                    <label for="id_custom_filter_pubt.systematicreview" class="choice-group-item-title-text">
                      Systematic Review
                    </label>
                  </li>
                
              
            
              
                
                  <li>
                    <input aria-checked="false" type="checkbox" name="custom-filter" id="id_custom_filter_pubt.technicalreport" value="pubt.technicalreport">
                    <label for="id_custom_filter_pubt.technicalreport" class="choice-group-item-title-text">
                      Technical Report
                    </label>
                  </li>
                
              
            
              
                
                  <li>
                    <input aria-checked="false" type="checkbox" name="custom-filter" id="id_custom_filter_pubt.twinstudy" value="pubt.twinstudy">
                    <label for="id_custom_filter_pubt.twinstudy" class="choice-group-item-title-text">
                      Twin Study
                    </label>
                  </li>
                
              
            
              
                
                  <li>
                    <input aria-checked="false" type="checkbox" name="custom-filter" id="id_custom_filter_pubt.validationstudy" value="pubt.validationstudy">
                    <label for="id_custom_filter_pubt.validationstudy" class="choice-group-item-title-text">
                      Validation Study
                    </label>
                  </li>
                
              
            
              
                
                  <li>
                    <input aria-checked="false" type="checkbox" name="custom-filter" id="id_custom_filter_pubt.videoaudiomedia" value="pubt.videoaudiomedia">
                    <label for="id_custom_filter_pubt.videoaudiomedia" class="choice-group-item-title-text">
                      Video-Audio Media
                    </label>
                  </li>
                
              
            
              
                
                  <li>
                    <input aria-checked="false" type="checkbox" name="custom-filter" id="id_custom_filter_pubt.webcast" value="pubt.webcast">
                    <label for="id_custom_filter_pubt.webcast" class="choice-group-item-title-text">
                      Webcast
                    </label>
                  </li>
                
              
            
          </ul>
        </div>
        <div class="actions-bar">
          <button class="cancel-btn" data-ga-category="filter" data-ga-action="additional_article_type_filters" data-ga-label="cancel">Cancel</button>
          <button class="filter-apply-btn" aria-disabled="true" data-pinger-ignore="">Apply</button>
        </div>
        <button class="close-overlay dialog-focus" title="close" data-pinger-ignore="true">Close dialog</button>
      </div>
    </div>
  

  

  

  

  

  


    


  

  

  

  

  
    <div class="overlay" role="dialog" aria-label="Article Language Filters">
      <div class="dialog customize-lang-filters-dialog" role="document">
        <div class="title title-lang">ARTICLE LANGUAGE</div>
        <div role="group" aria-labelledby="title-lang" class="custom-filters-checkbox-container" id="panel-lang">
          <ul class="choice-group-items items-lang">
            
              
                
                  <li>
                    <input aria-checked="false" type="checkbox" name="custom-filter" id="id_custom_filter_lang.afrikaans" value="lang.afrikaans">
                    <label for="id_custom_filter_lang.afrikaans" class="choice-group-item-title-text">
                      Afrikaans
                    </label>
                  </li>
                
              
            
              
                
                  <li>
                    <input aria-checked="false" type="checkbox" name="custom-filter" id="id_custom_filter_lang.albanian" value="lang.albanian">
                    <label for="id_custom_filter_lang.albanian" class="choice-group-item-title-text">
                      Albanian
                    </label>
                  </li>
                
              
            
              
                
                  <li>
                    <input aria-checked="false" type="checkbox" name="custom-filter" id="id_custom_filter_lang.arabic" value="lang.arabic">
                    <label for="id_custom_filter_lang.arabic" class="choice-group-item-title-text">
                      Arabic
                    </label>
                  </li>
                
              
            
              
                
                  <li>
                    <input aria-checked="false" type="checkbox" name="custom-filter" id="id_custom_filter_lang.armenian" value="lang.armenian">
                    <label for="id_custom_filter_lang.armenian" class="choice-group-item-title-text">
                      Armenian
                    </label>
                  </li>
                
              
            
              
                
                  <li>
                    <input aria-checked="false" type="checkbox" name="custom-filter" id="id_custom_filter_lang.azerbaijani" value="lang.azerbaijani">
                    <label for="id_custom_filter_lang.azerbaijani" class="choice-group-item-title-text">
                      Azerbaijani
                    </label>
                  </li>
                
              
            
              
                
                  <li>
                    <input aria-checked="false" type="checkbox" name="custom-filter" id="id_custom_filter_lang.bosnian" value="lang.bosnian">
                    <label for="id_custom_filter_lang.bosnian" class="choice-group-item-title-text">
                      Bosnian
                    </label>
                  </li>
                
              
            
              
                
                  <li>
                    <input aria-checked="false" type="checkbox" name="custom-filter" id="id_custom_filter_lang.bulgarian" value="lang.bulgarian">
                    <label for="id_custom_filter_lang.bulgarian" class="choice-group-item-title-text">
                      Bulgarian
                    </label>
                  </li>
                
              
            
              
                
                  <li>
                    <input aria-checked="false" type="checkbox" name="custom-filter" id="id_custom_filter_lang.catalan" value="lang.catalan">
                    <label for="id_custom_filter_lang.catalan" class="choice-group-item-title-text">
                      Catalan
                    </label>
                  </li>
                
              
            
              
                
                  <li>
                    <input aria-checked="false" type="checkbox" name="custom-filter" id="id_custom_filter_lang.chinese" value="lang.chinese">
                    <label for="id_custom_filter_lang.chinese" class="choice-group-item-title-text">
                      Chinese
                    </label>
                  </li>
                
              
            
              
                
                  <li>
                    <input aria-checked="false" type="checkbox" name="custom-filter" id="id_custom_filter_lang.croatian" value="lang.croatian">
                    <label for="id_custom_filter_lang.croatian" class="choice-group-item-title-text">
                      Croatian
                    </label>
                  </li>
                
              
            
              
                
                  <li>
                    <input aria-checked="false" type="checkbox" name="custom-filter" id="id_custom_filter_lang.czech" value="lang.czech">
                    <label for="id_custom_filter_lang.czech" class="choice-group-item-title-text">
                      Czech
                    </label>
                  </li>
                
              
            
              
                
                  <li>
                    <input aria-checked="false" type="checkbox" name="custom-filter" id="id_custom_filter_lang.danish" value="lang.danish">
                    <label for="id_custom_filter_lang.danish" class="choice-group-item-title-text">
                      Danish
                    </label>
                  </li>
                
              
            
              
                
                  <li>
                    <input aria-checked="false" type="checkbox" name="custom-filter" id="id_custom_filter_lang.dutch" value="lang.dutch">
                    <label for="id_custom_filter_lang.dutch" class="choice-group-item-title-text">
                      Dutch
                    </label>
                  </li>
                
              
            
              
                
                  <li>
                    <input aria-checked="false" type="checkbox" name="custom-filter" id="id_custom_filter_lang.english" value="lang.english">
                    <label for="id_custom_filter_lang.english" class="choice-group-item-title-text">
                      English
                    </label>
                  </li>
                
              
            
              
                
                  <li>
                    <input aria-checked="false" type="checkbox" name="custom-filter" id="id_custom_filter_lang.esperanto" value="lang.esperanto">
                    <label for="id_custom_filter_lang.esperanto" class="choice-group-item-title-text">
                      Esperanto
                    </label>
                  </li>
                
              
            
              
                
                  <li>
                    <input aria-checked="false" type="checkbox" name="custom-filter" id="id_custom_filter_lang.estonian" value="lang.estonian">
                    <label for="id_custom_filter_lang.estonian" class="choice-group-item-title-text">
                      Estonian
                    </label>
                  </li>
                
              
            
              
                
                  <li>
                    <input aria-checked="false" type="checkbox" name="custom-filter" id="id_custom_filter_lang.finnish" value="lang.finnish">
                    <label for="id_custom_filter_lang.finnish" class="choice-group-item-title-text">
                      Finnish
                    </label>
                  </li>
                
              
            
              
                
                  <li>
                    <input aria-checked="false" type="checkbox" name="custom-filter" id="id_custom_filter_lang.french" value="lang.french">
                    <label for="id_custom_filter_lang.french" class="choice-group-item-title-text">
                      French
                    </label>
                  </li>
                
              
            
              
                
                  <li>
                    <input aria-checked="false" type="checkbox" name="custom-filter" id="id_custom_filter_lang.georgian" value="lang.georgian">
                    <label for="id_custom_filter_lang.georgian" class="choice-group-item-title-text">
                      Georgian
                    </label>
                  </li>
                
              
            
              
                
                  <li>
                    <input aria-checked="false" type="checkbox" name="custom-filter" id="id_custom_filter_lang.german" value="lang.german">
                    <label for="id_custom_filter_lang.german" class="choice-group-item-title-text">
                      German
                    </label>
                  </li>
                
              
            
              
                
                  <li>
                    <input aria-checked="false" type="checkbox" name="custom-filter" id="id_custom_filter_lang.greekmodern" value="lang.greekmodern">
                    <label for="id_custom_filter_lang.greekmodern" class="choice-group-item-title-text">
                      Greek, Modern
                    </label>
                  </li>
                
              
            
              
                
                  <li>
                    <input aria-checked="false" type="checkbox" name="custom-filter" id="id_custom_filter_lang.hebrew" value="lang.hebrew">
                    <label for="id_custom_filter_lang.hebrew" class="choice-group-item-title-text">
                      Hebrew
                    </label>
                  </li>
                
              
            
              
                
                  <li>
                    <input aria-checked="false" type="checkbox" name="custom-filter" id="id_custom_filter_lang.hindi" value="lang.hindi">
                    <label for="id_custom_filter_lang.hindi" class="choice-group-item-title-text">
                      Hindi
                    </label>
                  </li>
                
              
            
              
                
                  <li>
                    <input aria-checked="false" type="checkbox" name="custom-filter" id="id_custom_filter_lang.hungarian" value="lang.hungarian">
                    <label for="id_custom_filter_lang.hungarian" class="choice-group-item-title-text">
                      Hungarian
                    </label>
                  </li>
                
              
            
              
                
                  <li>
                    <input aria-checked="false" type="checkbox" name="custom-filter" id="id_custom_filter_lang.icelandic" value="lang.icelandic">
                    <label for="id_custom_filter_lang.icelandic" class="choice-group-item-title-text">
                      Icelandic
                    </label>
                  </li>
                
              
            
              
                
                  <li>
                    <input aria-checked="false" type="checkbox" name="custom-filter" id="id_custom_filter_lang.indonesian" value="lang.indonesian">
                    <label for="id_custom_filter_lang.indonesian" class="choice-group-item-title-text">
                      Indonesian
                    </label>
                  </li>
                
              
            
              
                
                  <li>
                    <input aria-checked="false" type="checkbox" name="custom-filter" id="id_custom_filter_lang.italian" value="lang.italian">
                    <label for="id_custom_filter_lang.italian" class="choice-group-item-title-text">
                      Italian
                    </label>
                  </li>
                
              
            
              
                
                  <li>
                    <input aria-checked="false" type="checkbox" name="custom-filter" id="id_custom_filter_lang.japanese" value="lang.japanese">
                    <label for="id_custom_filter_lang.japanese" class="choice-group-item-title-text">
                      Japanese
                    </label>
                  </li>
                
              
            
              
                
                  <li>
                    <input aria-checked="false" type="checkbox" name="custom-filter" id="id_custom_filter_lang.kinyarwanda" value="lang.kinyarwanda">
                    <label for="id_custom_filter_lang.kinyarwanda" class="choice-group-item-title-text">
                      Kinyarwanda
                    </label>
                  </li>
                
              
            
              
                
                  <li>
                    <input aria-checked="false" type="checkbox" name="custom-filter" id="id_custom_filter_lang.korean" value="lang.korean">
                    <label for="id_custom_filter_lang.korean" class="choice-group-item-title-text">
                      Korean
                    </label>
                  </li>
                
              
            
              
                
                  <li>
                    <input aria-checked="false" type="checkbox" name="custom-filter" id="id_custom_filter_lang.latin" value="lang.latin">
                    <label for="id_custom_filter_lang.latin" class="choice-group-item-title-text">
                      Latin
                    </label>
                  </li>
                
              
            
              
                
                  <li>
                    <input aria-checked="false" type="checkbox" name="custom-filter" id="id_custom_filter_lang.latvian" value="lang.latvian">
                    <label for="id_custom_filter_lang.latvian" class="choice-group-item-title-text">
                      Latvian
                    </label>
                  </li>
                
              
            
              
                
                  <li>
                    <input aria-checked="false" type="checkbox" name="custom-filter" id="id_custom_filter_lang.lithuanian" value="lang.lithuanian">
                    <label for="id_custom_filter_lang.lithuanian" class="choice-group-item-title-text">
                      Lithuanian
                    </label>
                  </li>
                
              
            
              
                
                  <li>
                    <input aria-checked="false" type="checkbox" name="custom-filter" id="id_custom_filter_lang.macedonian" value="lang.macedonian">
                    <label for="id_custom_filter_lang.macedonian" class="choice-group-item-title-text">
                      Macedonian
                    </label>
                  </li>
                
              
            
              
                
                  <li>
                    <input aria-checked="false" type="checkbox" name="custom-filter" id="id_custom_filter_lang.malay" value="lang.malay">
                    <label for="id_custom_filter_lang.malay" class="choice-group-item-title-text">
                      Malay
                    </label>
                  </li>
                
              
            
              
                
                  <li>
                    <input aria-checked="false" type="checkbox" name="custom-filter" id="id_custom_filter_lang.malayalam" value="lang.malayalam">
                    <label for="id_custom_filter_lang.malayalam" class="choice-group-item-title-text">
                      Malayalam
                    </label>
                  </li>
                
              
            
              
                
                  <li>
                    <input aria-checked="false" type="checkbox" name="custom-filter" id="id_custom_filter_lang.maori" value="lang.maori">
                    <label for="id_custom_filter_lang.maori" class="choice-group-item-title-text">
                      Maori
                    </label>
                  </li>
                
              
            
              
                
                  <li>
                    <input aria-checked="false" type="checkbox" name="custom-filter" id="id_custom_filter_lang.multiplelanguages" value="lang.multiplelanguages">
                    <label for="id_custom_filter_lang.multiplelanguages" class="choice-group-item-title-text">
                      Multiple Languages
                    </label>
                  </li>
                
              
            
              
                
                  <li>
                    <input aria-checked="false" type="checkbox" name="custom-filter" id="id_custom_filter_lang.norwegian" value="lang.norwegian">
                    <label for="id_custom_filter_lang.norwegian" class="choice-group-item-title-text">
                      Norwegian
                    </label>
                  </li>
                
              
            
              
                
                  <li>
                    <input aria-checked="false" type="checkbox" name="custom-filter" id="id_custom_filter_lang.persian" value="lang.persian">
                    <label for="id_custom_filter_lang.persian" class="choice-group-item-title-text">
                      Persian
                    </label>
                  </li>
                
              
            
              
                
                  <li>
                    <input aria-checked="false" type="checkbox" name="custom-filter" id="id_custom_filter_lang.polish" value="lang.polish">
                    <label for="id_custom_filter_lang.polish" class="choice-group-item-title-text">
                      Polish
                    </label>
                  </li>
                
              
            
              
                
                  <li>
                    <input aria-checked="false" type="checkbox" name="custom-filter" id="id_custom_filter_lang.portuguese" value="lang.portuguese">
                    <label for="id_custom_filter_lang.portuguese" class="choice-group-item-title-text">
                      Portuguese
                    </label>
                  </li>
                
              
            
              
                
                  <li>
                    <input aria-checked="false" type="checkbox" name="custom-filter" id="id_custom_filter_lang.pushto" value="lang.pushto">
                    <label for="id_custom_filter_lang.pushto" class="choice-group-item-title-text">
                      Pushto
                    </label>
                  </li>
                
              
            
              
                
                  <li>
                    <input aria-checked="false" type="checkbox" name="custom-filter" id="id_custom_filter_lang.romanian" value="lang.romanian">
                    <label for="id_custom_filter_lang.romanian" class="choice-group-item-title-text">
                      Romanian
                    </label>
                  </li>
                
              
            
              
                
                  <li>
                    <input aria-checked="false" type="checkbox" name="custom-filter" id="id_custom_filter_lang.russian" value="lang.russian">
                    <label for="id_custom_filter_lang.russian" class="choice-group-item-title-text">
                      Russian
                    </label>
                  </li>
                
              
            
              
                
                  <li>
                    <input aria-checked="false" type="checkbox" name="custom-filter" id="id_custom_filter_lang.sanskrit" value="lang.sanskrit">
                    <label for="id_custom_filter_lang.sanskrit" class="choice-group-item-title-text">
                      Sanskrit
                    </label>
                  </li>
                
              
            
              
                
                  <li>
                    <input aria-checked="false" type="checkbox" name="custom-filter" id="id_custom_filter_lang.scottishgaelic" value="lang.scottishgaelic">
                    <label for="id_custom_filter_lang.scottishgaelic" class="choice-group-item-title-text">
                      Scottish gaelic
                    </label>
                  </li>
                
              
            
              
                
                  <li>
                    <input aria-checked="false" type="checkbox" name="custom-filter" id="id_custom_filter_lang.serbian" value="lang.serbian">
                    <label for="id_custom_filter_lang.serbian" class="choice-group-item-title-text">
                      Serbian
                    </label>
                  </li>
                
              
            
              
                
                  <li>
                    <input aria-checked="false" type="checkbox" name="custom-filter" id="id_custom_filter_lang.slovak" value="lang.slovak">
                    <label for="id_custom_filter_lang.slovak" class="choice-group-item-title-text">
                      Slovak
                    </label>
                  </li>
                
              
            
              
                
                  <li>
                    <input aria-checked="false" type="checkbox" name="custom-filter" id="id_custom_filter_lang.slovenian" value="lang.slovenian">
                    <label for="id_custom_filter_lang.slovenian" class="choice-group-item-title-text">
                      Slovenian
                    </label>
                  </li>
                
              
            
              
                
                  <li>
                    <input aria-checked="false" type="checkbox" name="custom-filter" id="id_custom_filter_lang.spanish" value="lang.spanish">
                    <label for="id_custom_filter_lang.spanish" class="choice-group-item-title-text">
                      Spanish
                    </label>
                  </li>
                
              
            
              
                
                  <li>
                    <input aria-checked="false" type="checkbox" name="custom-filter" id="id_custom_filter_lang.swedish" value="lang.swedish">
                    <label for="id_custom_filter_lang.swedish" class="choice-group-item-title-text">
                      Swedish
                    </label>
                  </li>
                
              
            
              
                
                  <li>
                    <input aria-checked="false" type="checkbox" name="custom-filter" id="id_custom_filter_lang.thai" value="lang.thai">
                    <label for="id_custom_filter_lang.thai" class="choice-group-item-title-text">
                      Thai
                    </label>
                  </li>
                
              
            
              
                
                  <li>
                    <input aria-checked="false" type="checkbox" name="custom-filter" id="id_custom_filter_lang.turkish" value="lang.turkish">
                    <label for="id_custom_filter_lang.turkish" class="choice-group-item-title-text">
                      Turkish
                    </label>
                  </li>
                
              
            
              
                
                  <li>
                    <input aria-checked="false" type="checkbox" name="custom-filter" id="id_custom_filter_lang.ukrainian" value="lang.ukrainian">
                    <label for="id_custom_filter_lang.ukrainian" class="choice-group-item-title-text">
                      Ukrainian
                    </label>
                  </li>
                
              
            
              
                
                  <li>
                    <input aria-checked="false" type="checkbox" name="custom-filter" id="id_custom_filter_lang.undetermined" value="lang.undetermined">
                    <label for="id_custom_filter_lang.undetermined" class="choice-group-item-title-text">
                      Undetermined
                    </label>
                  </li>
                
              
            
              
                
                  <li>
                    <input aria-checked="false" type="checkbox" name="custom-filter" id="id_custom_filter_lang.vietnamese" value="lang.vietnamese">
                    <label for="id_custom_filter_lang.vietnamese" class="choice-group-item-title-text">
                      Vietnamese
                    </label>
                  </li>
                
              
            
              
                
                  <li>
                    <input aria-checked="false" type="checkbox" name="custom-filter" id="id_custom_filter_lang.welsh" value="lang.welsh">
                    <label for="id_custom_filter_lang.welsh" class="choice-group-item-title-text">
                      Welsh
                    </label>
                  </li>
                
              
            
          </ul>
        </div>
        <div class="actions-bar">
          <button class="cancel-btn" data-ga-category="filter" data-ga-action="additional_language_filters" data-ga-label="cancel">Cancel</button>
          <button class="filter-apply-btn" aria-disabled="true" data-pinger-ignore="">Apply</button>
        </div>
        <button class="close-overlay dialog-focus" title="close" data-pinger-ignore="true">Close dialog</button>
      </div>
    </div>
  

  

  

  

  


    


  

  

  

  

  

  

  

  
    <div class="overlay" role="dialog" aria-label="Age Filters">
      <div class="dialog customize-age-filters-dialog" role="document">
        <div class="title title-age">AGE</div>
        <div role="group" aria-labelledby="title-age" class="custom-filters-checkbox-container" id="panel-age">
          <ul class="choice-group-items items-age">
            
              
                
                  <li>
                    <input aria-checked="false" type="checkbox" name="custom-filter" id="id_custom_filter_age.allchild" value="age.allchild">
                    <label for="id_custom_filter_age.allchild" class="choice-group-item-title-text">
                      Child: birth-18 years
                    </label>
                  </li>
                
              
            
              
                
                  <li>
                    <input aria-checked="false" type="checkbox" name="custom-filter" id="id_custom_filter_age.newborn" value="age.newborn">
                    <label for="id_custom_filter_age.newborn" class="choice-group-item-title-text">
                      Newborn: birth-1 month
                    </label>
                  </li>
                
              
            
              
                
                  <li>
                    <input aria-checked="false" type="checkbox" name="custom-filter" id="id_custom_filter_age.allinfant" value="age.allinfant">
                    <label for="id_custom_filter_age.allinfant" class="choice-group-item-title-text">
                      Infant: birth-23 months
                    </label>
                  </li>
                
              
            
              
                
                  <li>
                    <input aria-checked="false" type="checkbox" name="custom-filter" id="id_custom_filter_age.infant" value="age.infant">
                    <label for="id_custom_filter_age.infant" class="choice-group-item-title-text">
                      Infant: 1-23 months
                    </label>
                  </li>
                
              
            
              
                
                  <li>
                    <input aria-checked="false" type="checkbox" name="custom-filter" id="id_custom_filter_age.preschoolchild" value="age.preschoolchild">
                    <label for="id_custom_filter_age.preschoolchild" class="choice-group-item-title-text">
                      Preschool Child: 2-5 years
                    </label>
                  </li>
                
              
            
              
                
                  <li>
                    <input aria-checked="false" type="checkbox" name="custom-filter" id="id_custom_filter_age.child" value="age.child">
                    <label for="id_custom_filter_age.child" class="choice-group-item-title-text">
                      Child: 6-12 years
                    </label>
                  </li>
                
              
            
              
                
                  <li>
                    <input aria-checked="false" type="checkbox" name="custom-filter" id="id_custom_filter_age.adolescent" value="age.adolescent">
                    <label for="id_custom_filter_age.adolescent" class="choice-group-item-title-text">
                      Adolescent: 13-18 years
                    </label>
                  </li>
                
              
            
              
                
                  <li>
                    <input aria-checked="false" type="checkbox" name="custom-filter" id="id_custom_filter_age.alladult" value="age.alladult">
                    <label for="id_custom_filter_age.alladult" class="choice-group-item-title-text">
                      Adult: 19+ years
                    </label>
                  </li>
                
              
            
              
                
                  <li>
                    <input aria-checked="false" type="checkbox" name="custom-filter" id="id_custom_filter_age.youngadult" value="age.youngadult">
                    <label for="id_custom_filter_age.youngadult" class="choice-group-item-title-text">
                      Young Adult: 19-24 years
                    </label>
                  </li>
                
              
            
              
                
                  <li>
                    <input aria-checked="false" type="checkbox" name="custom-filter" id="id_custom_filter_age.adult" value="age.adult">
                    <label for="id_custom_filter_age.adult" class="choice-group-item-title-text">
                      Adult: 19-44 years
                    </label>
                  </li>
                
              
            
              
                
                  <li>
                    <input aria-checked="false" type="checkbox" name="custom-filter" id="id_custom_filter_age.middleagedaged" value="age.middleagedaged">
                    <label for="id_custom_filter_age.middleagedaged" class="choice-group-item-title-text">
                      Middle Aged + Aged: 45+ years
                    </label>
                  </li>
                
              
            
              
                
                  <li>
                    <input aria-checked="false" type="checkbox" name="custom-filter" id="id_custom_filter_age.middleaged" value="age.middleaged">
                    <label for="id_custom_filter_age.middleaged" class="choice-group-item-title-text">
                      Middle Aged: 45-64 years
                    </label>
                  </li>
                
              
            
              
                
                  <li>
                    <input aria-checked="false" type="checkbox" name="custom-filter" id="id_custom_filter_age.aged" value="age.aged">
                    <label for="id_custom_filter_age.aged" class="choice-group-item-title-text">
                      Aged: 65+ years
                    </label>
                  </li>
                
              
            
              
                
                  <li>
                    <input aria-checked="false" type="checkbox" name="custom-filter" id="id_custom_filter_age.80andover" value="age.80andover">
                    <label for="id_custom_filter_age.80andover" class="choice-group-item-title-text">
                      80 and over: 80+ years
                    </label>
                  </li>
                
              
            
          </ul>
        </div>
        <div class="actions-bar">
          <button class="cancel-btn" data-ga-category="filter" data-ga-action="additional_age_filters" data-ga-label="cancel">Cancel</button>
          <button class="filter-apply-btn" aria-disabled="true" data-pinger-ignore="">Apply</button>
        </div>
        <button class="close-overlay dialog-focus" title="close" data-pinger-ignore="true">Close dialog</button>
      </div>
    </div>
  

  


    <div class="overlay" aria-label="Confirm resetting filters" role="dialog" aria-describedby="confirm_reset_filters_text">
  <div id="reset_filters_dialog" class="dialog reset-filters-dialog" role="document">
    <div class="confirm-reset-filters-text" id="confirm_reset_filters_text">Filters on the sidebar will be reset to the default list and any currently applied filters will be cleared.</div>
    <button class="usa-button submit-button dialog-focus" ref="linksrc=confirm_reset_filters_btn" data-ga-category="filter" data-ga-action="reset_filter" data-ga-label="reset_confirm">Confirm</button>
    <button class="close-overlay" title="close" data-pinger-ignore="true">[x]</button>
  </div>
</div>
    <button class="back-to-top" data-ga-category="pagination" data-ga-action="back_to_top">
  Back to Top
</button>

    

<div class="overlay" role="dialog" aria-label="Jump to Page Dialog">
  <div class="dialog jump-to-page-dialog" data-max-page="183">
    <label class="title" for="jump-to-page-number">
      Jump to page
    </label>
    <button class="close-overlay" title="close" tabindex="4">Close dialog</button>

    <form action=".">
      <div class="page-input">
        <input type="number" autocomplete="off" class="page-number dialog-focus" id="jump-to-page-number" tabindex="1" value="3" title="Enter page number that you want to navigate to" min="1" max="183">
        of
        <span class="total-pages">
        183
        </span>
      </div>

      <button class="usa-button submit-button" ref="linksrc=jump_page_btn" tabindex="3" data-pinger-ignore="">Jump</button>
    </form>
  </div>
</div>
  </main>


    <div id="ncbi-footer">
      <div class="literature-footer" role="complementary" title="Links to NCBI Literature Resources">
  <div class="usa-grid">
    <p class="literature-footer-text">NCBI Literature Resources</p>
    <p class="literature-footer-text">
      <a class="literature-footer-link" data-ga-category="literature_resources" data-ga-action="mesh_link" href="https://www.ncbi.nlm.nih.gov/mesh/">MeSH</a>
      <a class="literature-footer-link" data-ga-category="literature_resources" data-ga-action="pmc_link" href="https://www.ncbi.nlm.nih.gov/pmc/">PMC</a>
      <a class="literature-footer-link" data-ga-category="literature_resources" data-ga-action="bookshelf_link" href="https://www.ncbi.nlm.nih.gov/books">Bookshelf</a>
      <a class="literature-footer-link" data-ga-category="literature_resources" data-ga-action="disclaimer_link" href="/disclaimer/">Disclaimer</a>
    </p>
    <p class="literature-footer-text attribution-statement">The PubMed wordmark and PubMed logo are registered trademarks of the U.S. Department of Health and Human Services (HHS). Unauthorized use of these marks is strictly prohibited.</p>
  </div>
</div>
       <!-- ========== BEGIN FOOTER ========== -->
 <footer>
      <section class="icon-section">
        <div id="icon-section-header" class="icon-section_header">Follow NCBI</div>
        <div class="grid-container container">
          <div class="icon-section_container">
            <a class="footer-icon" id="footer_twitter" href="https://twitter.com/ncbi" aria-label="Twitter">
                <svg width="40" height="40" viewBox="0 0 40 37" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <title>Twitter</title>
                    <g id="twitterx1008">
                        <path id="path1008" d="M6.06736 7L16.8778 20.8991L6.00001 32.2H10.2L18.6 23.1L25.668 32.2H34L22.8 17.5L31.9 7H28.4L20.7 15.4L14.401 7H6.06898H6.06736ZM9.66753 8.73423H12.9327L29.7327 30.4658H26.5697L9.66753 8.73423Z" fill="#5B616B"></path>
                    </g>
                </svg>
            </a>
            <a class="footer-icon" id="footer_facebook" href="https://www.facebook.com/ncbi.nlm" aria-label="Facebook"><svg data-name="Layer 1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 300">
                <title>Facebook</title>
                <path class="cls-11" d="M210.5,115.12H171.74V97.82c0-8.14,5.39-10,9.19-10h27.14V52l-39.32-.12c-35.66,0-42.42,26.68-42.42,43.77v19.48H99.09v36.32h27.24v109h45.41v-109h35Z">
                </path>
              </svg></a>
            <a class="footer-icon" id="footer_linkedin" href="https://www.linkedin.com/company/ncbinlm" aria-label="LinkedIn"><svg data-name="Layer 1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 300">
                <title>LinkedIn</title>
                <path class="cls-11" d="M101.64,243.37H57.79v-114h43.85Zm-22-131.54h-.26c-13.25,0-21.82-10.36-21.82-21.76,0-11.65,8.84-21.15,22.33-21.15S101.7,78.72,102,90.38C102,101.77,93.4,111.83,79.63,111.83Zm100.93,52.61A17.54,17.54,0,0,0,163,182v61.39H119.18s.51-105.23,0-114H163v13a54.33,54.33,0,0,1,34.54-12.66c26,0,44.39,18.8,44.39,55.29v58.35H198.1V182A17.54,17.54,0,0,0,180.56,164.44Z">
                </path>
              </svg></a>
            <a class="footer-icon" id="footer_github" href="https://github.com/ncbi" aria-label="GitHub"><svg data-name="Layer 1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 300">
                <defs>
                  <style>
                    .cls-11,
                    .cls-12 {
                      fill: #737373;
                    }

                    .cls-11 {
                      fill-rule: evenodd;
                    }
                  </style>
                </defs>
                <title>GitHub</title>
                <path class="cls-11" d="M151.36,47.28a105.76,105.76,0,0,0-33.43,206.1c5.28,1,7.22-2.3,7.22-5.09,0-2.52-.09-10.85-.14-19.69-29.42,6.4-35.63-12.48-35.63-12.48-4.81-12.22-11.74-15.47-11.74-15.47-9.59-6.56.73-6.43.73-6.43,10.61.75,16.21,10.9,16.21,10.9,9.43,16.17,24.73,11.49,30.77,8.79,1-6.83,3.69-11.5,6.71-14.14C108.57,197.1,83.88,188,83.88,147.51a40.92,40.92,0,0,1,10.9-28.39c-1.1-2.66-4.72-13.42,1-28,0,0,8.88-2.84,29.09,10.84a100.26,100.26,0,0,1,53,0C198,88.3,206.9,91.14,206.9,91.14c5.76,14.56,2.14,25.32,1,28a40.87,40.87,0,0,1,10.89,28.39c0,40.62-24.74,49.56-48.29,52.18,3.79,3.28,7.17,9.71,7.17,19.58,0,14.15-.12,25.54-.12,29,0,2.82,1.9,6.11,7.26,5.07A105.76,105.76,0,0,0,151.36,47.28Z">
                </path>
                <path class="cls-12" d="M85.66,199.12c-.23.52-1.06.68-1.81.32s-1.2-1.06-.95-1.59,1.06-.69,1.82-.33,1.21,1.07.94,1.6Zm-1.3-1">
                </path>
                <path class="cls-12" d="M90,203.89c-.51.47-1.49.25-2.16-.49a1.61,1.61,0,0,1-.31-2.19c.52-.47,1.47-.25,2.17.49s.82,1.72.3,2.19Zm-1-1.08">
                </path>
                <path class="cls-12" d="M94.12,210c-.65.46-1.71,0-2.37-.91s-.64-2.07,0-2.52,1.7,0,2.36.89.65,2.08,0,2.54Zm0,0"></path>
                <path class="cls-12" d="M99.83,215.87c-.58.64-1.82.47-2.72-.41s-1.18-2.06-.6-2.7,1.83-.46,2.74.41,1.2,2.07.58,2.7Zm0,0">
                </path>
                <path class="cls-12" d="M107.71,219.29c-.26.82-1.45,1.2-2.64.85s-2-1.34-1.74-2.17,1.44-1.23,2.65-.85,2,1.32,1.73,2.17Zm0,0">
                </path>
                <path class="cls-12" d="M116.36,219.92c0,.87-1,1.59-2.24,1.61s-2.29-.68-2.3-1.54,1-1.59,2.26-1.61,2.28.67,2.28,1.54Zm0,0">
                </path>
                <path class="cls-12" d="M124.42,218.55c.15.85-.73,1.72-2,1.95s-2.37-.3-2.52-1.14.73-1.75,2-2,2.37.29,2.53,1.16Zm0,0"></path>
              </svg></a>
            <a class="footer-icon" id="footer_blog" href="https://ncbiinsights.ncbi.nlm.nih.gov/" aria-label="Blog">
              <svg id="Layer_1" data-name="Layer 1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><defs><style>.cls-1{fill:#737373;}</style></defs><path class="cls-1" d="M14,30a4,4,0,1,1-4-4,4,4,0,0,1,4,4Zm11,3A19,19,0,0,0,7.05,15a1,1,0,0,0-1,1v3a1,1,0,0,0,.93,1A14,14,0,0,1,20,33.07,1,1,0,0,0,21,34h3a1,1,0,0,0,1-1Zm9,0A28,28,0,0,0,7,6,1,1,0,0,0,6,7v3a1,1,0,0,0,1,1A23,23,0,0,1,29,33a1,1,0,0,0,1,1h3A1,1,0,0,0,34,33Z"></path></svg>
            </a>
          </div>
        </div>
      </section>

      <section class="container-fluid bg-primary">
        <div class="container pt-5">
          <div class="row mt-3">
            <div class="col-lg-3 col-12">
              <p><a class="text-white" href="https://www.nlm.nih.gov/socialmedia/index.html">Connect with NLM</a></p>
              <ul class="list-inline social_media">
                <li class="list-inline-item"><a href="https://twitter.com/NLM_NIH" aria-label="Twitter" target="_blank" rel="noopener noreferrer">
                    <svg width="35" height="35" viewBox="0 0 38 35" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <title>Twitter</title>
                        <g id="twitterx1009" clip-path="url(#clip0_65276_3946)">
                            <path id="Vector" d="M17.5006 34.6565C26.9761 34.6565 34.6575 26.9751 34.6575 17.4996C34.6575 8.02416 26.9761 0.342773 17.5006 0.342773C8.02514 0.342773 0.34375 8.02416 0.34375 17.4996C0.34375 26.9751 8.02514 34.6565 17.5006 34.6565Z" fill="#205493" stroke="white" stroke-width="1.2" stroke-miterlimit="10"></path>
                            <path id="path1009" d="M8.54811 8.5L16.2698 18.4279L8.50001 26.5H11.5L17.5 20L22.5486 26.5H28.5L20.5 16L27 8.5H24.5L19 14.5L14.5007 8.5H8.54927H8.54811ZM11.1197 9.73873H13.4519L25.4519 25.2613H23.1926L11.1197 9.73873Z" fill="white"></path>
                        </g>
                        <defs>
                            <clipPath id="clip0_65276_3946">
                                <rect width="38" height="38" fill="white"></rect>
                            </clipPath>
                        </defs>
                    </svg></a>
                </li>
                <li class="list-inline-item"><a href="https://www.facebook.com/nationallibraryofmedicine" aria-label="Facebook" rel="noopener noreferrer" target="_blank">
                    <svg version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" x="0px" y="0px" viewBox="0 0 249 249" style="enable-background:new 0 0 249 249;" xml:space="preserve">
                      <style type="text/css">
                        .st10 {
                          fill: #FFFFFF;
                        }

                        .st110 {
                          fill: none;
                          stroke: #FFFFFF;
                          stroke-width: 8;
                          stroke-miterlimit: 10;
                        }
                      </style>
                      <title>SM-Facebook</title>
                      <g>
                        <g>
                          <path class="st10" d="M159,99.1h-24V88.4c0-5,3.3-6.2,5.7-6.2h16.8V60l-24.4-0.1c-22.1,0-26.2,16.5-26.2,27.1v12.1H90v22.5h16.9
                                                      v67.5H135v-67.5h21.7L159,99.1z"></path>
                        </g>
                      </g>
                      <circle class="st110" cx="123.6" cy="123.2" r="108.2"></circle>
                    </svg>
                  </a></li>
                <li class="list-inline-item"><a href="https://www.youtube.com/user/NLMNIH" aria-label="Youtube" target="_blank" rel="noopener noreferrer"><svg version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" x="0px" y="0px" viewBox="0 0 249 249" style="enable-background:new 0 0 249 249;" xml:space="preserve">
                      <title>SM-Youtube</title>
                      <style type="text/css">
                        .st4 {
                          fill: none;
                          stroke: #FFFFFF;
                          stroke-width: 8;
                          stroke-miterlimit: 10;
                        }

                        .st5 {
                          fill: #FFFFFF;
                        }
                      </style>
                      <circle class="st4" cx="124.2" cy="123.4" r="108.2"></circle>
                      <g transform="translate(0,-952.36218)">
                        <path class="st5" d="M88.4,1037.4c-10.4,0-18.7,8.3-18.7,18.7v40.1c0,10.4,8.3,18.7,18.7,18.7h72.1c10.4,0,18.7-8.3,18.7-18.7
                                            v-40.1c0-10.4-8.3-18.7-18.7-18.7H88.4z M115.2,1058.8l29.4,17.4l-29.4,17.4V1058.8z"></path>
                      </g>
                    </svg></a></li>
              </ul>
            </div>
            <div class="col-lg-3 col-12">
              <p class="address_footer text-white">National Library of Medicine<br>
                <a href="https://www.google.com/maps/place/8600+Rockville+Pike,+Bethesda,+MD+20894/@38.9959508,-77.101021,17z/data=!3m1!4b1!4m5!3m4!1s0x89b7c95e25765ddb:0x19156f88b27635b8!8m2!3d38.9959508!4d-77.0988323" class="text-white" target="_blank" rel="noopener noreferrer">8600 Rockville Pike<br>
                  Bethesda, MD 20894</a></p>
            </div>
            <div class="col-lg-3 col-12 centered-lg">
              <p><a href="https://www.nlm.nih.gov/web_policies.html" class="text-white">Web Policies</a><br>
                <a href="https://www.nih.gov/institutes-nih/nih-office-director/office-communications-public-liaison/freedom-information-act-office" class="text-white">FOIA</a><br>
                <a href="https://www.hhs.gov/vulnerability-disclosure-policy/index.html" class="text-white" id="vdp">HHS Vulnerability Disclosure</a></p>
            </div>
            <div class="col-lg-3 col-12 centered-lg">
              <p><a class="supportLink text-white" href="https://support.nlm.nih.gov/?pagename=pubmed%3Apubmed%3Asearchresult%3ANONE" data-pinger-pagename-param="true">Help</a><br>
                <a href="https://www.nlm.nih.gov/accessibility.html" class="text-white">Accessibility</a><br>
                <a href="https://www.nlm.nih.gov/careers/careers.html" class="text-white">Careers</a></p>
            </div>
          </div>
          <div class="row">
            <div class="col-lg-12 centered-lg">
              <nav class="bottom-links">
                <ul class="mt-3">
                  <li>
                    <a class="text-white" href="//www.nlm.nih.gov/">NLM</a>
                  </li>
                  <li>
                    <a class="text-white" href="https://www.nih.gov/">NIH</a>
                  </li>
                  <li>
                    <a class="text-white" href="https://www.hhs.gov/">HHS</a>
                  </li>
                  <li>
                    <a class="text-white" href="https://www.usa.gov/">USA.gov</a>
                  </li>
                </ul>
              </nav>
            </div>
          </div>
        </div>
      </section>
    </footer>
 <!-- ========== END FOOTER ========== -->
  <!-- javascript to inject NWDS meta tags. Note: value of nwds_version is updated by "npm version" command -->
 
  <script type="text/javascript">
    var nwds_version = "1.2.5";

    var meta_nwds_ver = document.createElement('meta');
    meta_nwds_ver.name = 'ncbi_nwds_ver';
    meta_nwds_ver.content = nwds_version;
    document.getElementsByTagName('head')[0].appendChild(meta_nwds_ver);

    var meta_nwds = document.createElement('meta');
    meta_nwds.name = 'ncbi_nwds';
    meta_nwds.content = 'yes';
    document.getElementsByTagName('head')[0].appendChild(meta_nwds);

	var alertsUrl = "/core/alerts/alerts.js";
	if (typeof ncbiBaseUrl !== 'undefined') {
		alertsUrl = ncbiBaseUrl + alertsUrl;
	}
  </script>

    </div>

  



  
  


  
  
  <!-- jQuery with plugins -->

  
    <script src="https://cdn.ncbi.nlm.nih.gov/pubmed/6aa07a65-6caa-4bbc-acaa-48623b669c29/CACHE/js/output.1119c5b65e07.js"></script>
  

  

  <!-- Project base scripts -->
  
    <script src="https://cdn.ncbi.nlm.nih.gov/pubmed/6aa07a65-6caa-4bbc-acaa-48623b669c29/CACHE/js/output.598ebf77bf13.js"></script>
  

  <script>
    ncbi.awesome.basePage.init({
      userInfo: {
        isLoggedIn: false,
        username: "",
        loginUrl: "https://account.ncbi.nlm.nih.gov/?back_url=https%3A%2F%2Fpubmed.ncbi.nlm.nih.gov%2F%3Fterm%3D%28hypertension%255BTitle%255D%29%2520AND%2520%28food%255BText%2520Word%255D%29%2520%26page%3D2",
        logoutUrl: "https://www.ncbi.nlm.nih.gov/account/signout/?back_url=https%3A//pubmed.ncbi.nlm.nih.gov/%3Fterm%3D%28hypertension%255BTitle%255D%29%2520AND%2520%28food%255BText%2520Word%255D%29%2520%26page%3D2"
      },
      baseUrl: 'https://www.ncbi.nlm.nih.gov',
      noSessionCookieName: "pm-ns",
      searchIdCookieName: "pm-sid",
      adjNavSearchIdCookieName: "pm-adjnav-sid",
      searchFormSubmittedCookieName: "pm-sfs",
      isOnSearchPageCookieName: "pm-iosp",
      backToSearchCookieName: "pm-btsl",
      clinicalSeeAllCookieName: "pm-csa",
      jsCookieDomain: "pubmed.ncbi.nlm.nih.gov",
      userShareRequestFailed: "",
      noSharedSettings: "myncbi_no_shared_settings",
      noSharedAccount: "myncbi_no_shared_account"
    });
  </script>

  <script type="module">
    import dismissableNCBIAlert from "https://cdn.ncbi.nlm.nih.gov/pubmed/6aa07a65-6caa-4bbc-acaa-48623b669c29/core/dismissable-ncbi-alert.js";

    jQuery.getScript("https://cdn.ncbi.nlm.nih.gov/core/alerts/alerts.js", function () {
      galert(['.usa-skipnav', 'body > *:first-child']);
      dismissableNCBIAlert();
    }).fail(function() {
    });
  </script>

  
  <script defer="" type="text/javascript" src="https://cdn.ncbi.nlm.nih.gov/core/pinger/pinger.js"> </script>


  
  


  


  <svg class="timeline-filter-gradient" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="timeline-filter-selected-gradient" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2="100%">
        <stop offset="0" stop-color="#0d71ba"></stop>
        <stop offset="0.7" stop-color="#1fb597"></stop>
        <stop offset="1" stop-color="#1eb194"></stop>
      </linearGradient>
      <linearGradient id="timeline-filter-hovered-gradient" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2="100%">
        <stop offset="0" stop-color="#0c62a5"></stop>
        <stop offset="0.7" stop-color="#1c9a7f"></stop>
      </linearGradient>
    </defs>
  </svg>



  <!-- Search page scripts -->
  <script src="https://cdn.ncbi.nlm.nih.gov/pubmed/6aa07a65-6caa-4bbc-acaa-48623b669c29/CACHE/js/output.f9ff76483b3a.js"></script>

  
  

  <script>
    ncbi.awesome.searchPage.init({
      searchQuery: "(hypertension[Title]) AND (food[Text Word])",
      searchConstants: {
        FILTER_KEY: "filter",
        FILTER_1_YEAR: "datesearch.y_1",
        FILTER_5_YEARS: "datesearch.y_5",
        FILTER_10_YEARS: "datesearch.y_10",
        FILTER_CUSTOM_RANGE: "dates",
        FILTER_YEARS_RANGE_TEMPLATE: "years.{}-{}",
        FORMAT_KEY: "format",
        FORMAT_ABSTRACT: "abstract",
        expandedTimelineStateQueryParam: {
          name: "timeline",
          value: "expanded"
        }
      },
      totalResults: parseInt("1827", 10),
      itemsPerPage: parseInt("10", 10),
      maxSelectedAmount: 10000,
      baseSuggestionsUrl: "/suggestions/",
      timelineData: {
        yearCounts: "[[1947, 1], [1951, 1], [1952, 1], [1954, 2], [1958, 1], [1959, 1], [1962, 1], [1964, 1], [1967, 2], [1968, 1], [1969, 1], [1970, 2], [1973, 1], [1974, 4], [1975, 4], [1976, 2], [1977, 4], [1978, 3], [1979, 3], [1980, 7], [1981, 1], [1982, 11], [1983, 9], [1984, 12], [1985, 15], [1986, 9], [1987, 7], [1988, 7], [1989, 9], [1990, 16], [1991, 16], [1992, 11], [1993, 12], [1994, 10], [1995, 20], [1996, 18], [1997, 21], [1998, 13], [1999, 25], [2000, 19], [2001, 15], [2002, 18], [2003, 12], [2004, 24], [2005, 30], [2006, 32], [2007, 44], [2008, 44], [2009, 40], [2010, 49], [2011, 39], [2012, 55], [2013, 61], [2014, 78], [2015, 75], [2016, 71], [2017, 88], [2018, 92], [2019, 76], [2020, 108], [2021, 118], [2022, 129], [2023, 131], [2024, 149], [2025, 141], [2026, 6]]",
        startYear: null,
        endYear: null
      },
      sortByCookieName: "pm-sb",
      sortOrderCookieName: "pm-so",
      sizeCookieName: "pm-ps",
      searchIdCookieName: "pm-sid",
      searchFormSubmittedCookieName: "pm-sfs",
      isOnSearchPageCookieName: "pm-iosp",
      sensorCookieName: "pm-dismiss-sensor",
      schemaAllActive: "False",
      mathJaxUrl: "https://cdn.ncbi.nlm.nih.gov/pubmed/6aa07a65-6caa-4bbc-acaa-48623b669c29/mathjax/unpacked/MathJax.js?config=MML_CHTML",
      clipboardAPIRoot: "/ajax/clipboard/",
      clipboardNextPageUrl: "/clipboard-next-page/",
      rootUrl: "/",
      jsCookieDomain: "pubmed.ncbi.nlm.nih.gov",
      adjNavSearchIdCookieName: "pm-adjnav-sid",
      showSnippetsCookieName: "pm-hs",
      termHighlightColor: "",
      highlightedTokens: "",
      markJSUrl: "https://cdn.ncbi.nlm.nih.gov/pubmed/6aa07a65-6caa-4bbc-acaa-48623b669c29/mark.js/dist/jquery.mark.js",
      citeDropdownOffsetFlipped: "275",
      shareDropdownOffsetFlipped: "",
      dropdownOffset: "40",
      citeFormatPreferenceCookieName: "pm-cf",
      dismissSingleAuthorAlertCookieName: "pm-sasa",
      additionalFiltersExpandedCookieName: "pm-afx"
    });
  </script><div class="fake-body-scroll"></div><div class="fake-body-scroll"></div><div class="fake-body-scroll"></div><div class="fake-body-scroll"></div><div class="fake-body-scroll"></div>


<div id="ZN_dikYWqsjiUWN0Q5"></div><div id="react-toast" class="Toaster"><span class="Toaster__manager-top-left" style="max-width: 560px; position: fixed; z-index: 5500; pointer-events: none; top: 0px; left: 0px;"></span><span class="Toaster__manager-top" style="max-width: 560px; position: fixed; z-index: 5500; pointer-events: none; margin: 0px auto; text-align: center; top: 0px; right: 0px; left: 0px;"></span><span class="Toaster__manager-top-right" style="max-width: 560px; position: fixed; z-index: 5500; pointer-events: none; top: 0px; right: 0px;"></span><span class="Toaster__manager-bottom-left" style="max-width: 560px; position: fixed; z-index: 5500; pointer-events: none; bottom: 0px; left: 0px;"></span><span class="Toaster__manager-bottom" style="max-width: 560px; position: fixed; z-index: 5500; pointer-events: none; margin: 0px auto; text-align: center; bottom: 0px; right: 0px; left: 0px;"></span><span class="Toaster__manager-bottom-right" style="max-width: 560px; position: fixed; z-index: 5500; pointer-events: none; bottom: 0px; right: 0px;"></span></div><script id="_fed_an_ua_tag" text="" charset="" type="text/javascript" src="https://dap.digitalgov.gov/Universal-Federated-Analytics-Min.js?agency=HHS&amp;subagency=NCBI%20-%20ncbi.nlm.nih.gov&amp;sitetopic=NCBI%20Pinger%200.39.3&amp;siteplatform=NCBI%20Pinger%200.39.3"></script><div id="allow_copycopy-2076e194124e2936e3b3d29ff98f2c4e"><div class="allow_copy_content" style="top: 0px; left: 0px; display: none;"><span>复制</span></div></div><script type="text/javascript" src="https://zndikYWqsjiUWN0Q5-nlmenterprise.siteintercept.qualtrics.com/SIE/?Q_ZID=ZN_dikYWqsjiUWN0Q5"></script><script src="https://siteintercept.qualtrics.com/dxjsmodule/CoreModule.js?Q_CLIENTVERSION=2.40.2&amp;Q_CLIENTTYPE=web&amp;Q_BRANDID=nlmenterprise" defer=""></script></body><div id="saladict" style="font-size: 0px; width: 0px; height: 0px;"><template shadowrootmode="closed"><style><style data-emotion="saladict" data-s=""></style><style data-emotion="saladict-global" data-s=""></style></style><div><div class="MuiPaper-root MuiPaper-elevation MuiPaper-rounded MuiPaper-elevation4 saladict-183ej5a" style="--Paper-shadow: 0px 2px 4px -1px rgba(0,0,0,0.2),0px 4px 5px 0px rgba(0,0,0,0.14),0px 1px 10px 0px rgba(0,0,0,0.12); opacity: 1; position: fixed; left: 370px; top: 150px; z-index: 2147483647; display: none; border-radius: 20px; --Paper-overlay: linear-gradient(rgba(255, 255, 255, 0.092), rgba(255, 255, 255, 0.092));"><div style="touch-action: none;"><div class="MuiBox-root saladict-0" style="cursor: move;"><div class="MuiStack-root saladict-1xanggh"><div class="MuiStack-root saladict-1yae3jf"><div class="MuiTypography-root MuiTypography-body1 saladict-uuml30">沙拉翻译</div></div><button class="MuiButtonBase-root MuiIconButton-root MuiIconButton-sizeMedium saladict-6z0vmc" tabindex="0" type="button"><svg class="MuiSvgIcon-root MuiSvgIcon-fontSizeMedium saladict-vcryad" focusable="false" aria-hidden="true" viewBox="0 0 24 24"><path d="M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"></path></svg></button></div><hr class="MuiDivider-root MuiDivider-fullWidth saladict-10yr5f2"></div></div><div></div></div><div style="opacity: 0.6; position: fixed; left: -20px; top: 518.667px; z-index: 2147483647; display: block; border-radius: 20px;"><div style="touch-action: none;"><div id="immersiveTranslator"><div id="immersiveTranslator_fab" style="position: relative;"><button class="MuiButtonBase-root MuiFab-root MuiFab-circular MuiFab-sizeSmall MuiFab-primary MuiFab-root MuiFab-circular MuiFab-sizeSmall MuiFab-primary saladict-10oeasd" tabindex="0" type="button"><svg class="MuiSvgIcon-root MuiSvgIcon-fontSizeMedium saladict-1jfx6pf" focusable="false" aria-hidden="true" viewBox="0 0 24 24"><path d="m12.87 15.07-2.54-2.51.03-.03c1.74-1.94 2.98-4.17 3.71-6.53H17V4h-7V2H8v2H1v1.99h11.17C11.5 7.92 10.44 9.75 9 11.35 8.07 10.32 7.3 9.19 6.69 8h-2c.73 1.63 1.73 3.17 2.98 4.56l-5.09 5.02L4 19l5-5 3.11 3.11zM18.5 10h-2L12 22h2l1.12-3h4.75L21 22h2zm-2.62 7 1.62-4.33L19.12 17z"></path></svg></button><svg width="11" height="11" viewBox="0 0 11 11" fill="none" style="display: none; position: absolute; z-index: 1999; bottom: 0px; left: auto; right: 0px;"><title>Checkmark Icon</title><circle cx="5.5" cy="5.5" r="5.5" fill="#68CD52"></circle><path d="M1.40857 5.87858L2.24148 5.18962L4.15344 6.64214C4.15344 6.64214 6.33547 4.15566 9.00658 2.48145L9.32541 2.87514C9.32541 2.87514 6.28665 5.55844 4.71735 9.07881L1.40857 5.87858Z" fill="white"></path></svg></div><div id="immersiveTranslator_settings" style="margin-top: 10px; display: none;"><button class="MuiButtonBase-root MuiFab-root MuiFab-circular MuiFab-sizeSmall MuiFab-primary MuiFab-root MuiFab-circular MuiFab-sizeSmall MuiFab-primary saladict-10oeasd" tabindex="0" type="button"><svg class="MuiSvgIcon-root MuiSvgIcon-fontSizeMedium saladict-1jfx6pf" focusable="false" aria-hidden="true" viewBox="0 0 24 24"><path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6"></path></svg></button></div></div></div><div></div></div></div></template></div></html>`