export class BaiduOCR {
  private static readonly API_KEY = process.env.BAIDU_OCR_API_KEY;
  private static readonly SECRET_KEY = process.env.BAIDU_OCR_SECRET_KEY;
  private static readonly API_URL =
    "https://aip.baidubce.com/rest/2.0/ocr/v1/general_basic";

  public static async processImage(imageBuffer: Buffer): Promise<string> {
    if (!this.API_KEY || !this.SECRET_KEY) {
      throw new Error("Baidu OCR API credentials not configured");
    }

    const accessToken = await this.getAccessToken();
    const base64Image = imageBuffer.toString("base64");

    const response = await fetch(this.API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: new URLSearchParams({
        access_token: accessToken,
        image: base64Image,
      }),
    });

    if (!response.ok) {
      throw new Error(`OCR API request failed: ${response.statusText}`);
    }

    const data = await response.json();
    return this.formatOCRResult(data);
  }

  private static async getAccessToken(): Promise<string> {
    const response = await fetch(
      `https://aip.baidubce.com/oauth/2.0/token?grant_type=client_credentials&client_id=${this.API_KEY}&client_secret=${this.SECRET_KEY}`,
      { method: "POST" },
    );

    if (!response.ok) {
      throw new Error("Failed to get Baidu OCR access token");
    }

    const data = await response.json();
    return data.access_token;
  }

  private static formatOCRResult(data: any): string {
    if (!data.words_result || !Array.isArray(data.words_result)) {
      throw new Error("Invalid OCR response format");
    }

    return data.words_result
      .map((item: { words: string }) => item.words)
      .join("\n");
  }
}
