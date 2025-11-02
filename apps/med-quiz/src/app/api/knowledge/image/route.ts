import { NextResponse } from "next/server";
import OSS from "ali-oss";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const imagePath = searchParams.get("path");

  console.log("=== DEBUG: Image API Called ===");
  console.log("Raw image path:", imagePath);

  if (!imagePath) {
    console.log("Missing path parameter");
    return NextResponse.json(
      { error: "Image path is required" },
      { status: 400 },
    );
  }

  try {
    // Initialize OSS client using environment variables
    const client = new OSS({
      accessKeyId: process.env.AWS_ACCESS_KEY_ID as string,
      accessKeySecret: process.env.AWS_SECRET_ACCESS_KEY as string,
      bucket: process.env.KB_BUCKET_NAME as string,
      region: process.env.AWS_REGION as string,
      secure: true,
    });

    // Clean the path and ensure proper format
    let cleanPath = imagePath.replace(/^\/+/, "");
    console.log("Cleaned path:", cleanPath);

    // Handle spaces and special characters in filenames
    cleanPath = decodeURIComponent(cleanPath);
    console.log("Decoded path:", cleanPath);

    // Special handling for pasted images
    if (cleanPath.includes("Pasted image")) {
      console.log("Detected pasted image format:", cleanPath);

      // Try exact path first
      const exactPaths = [
        // cleanPath,
        `images/${cleanPath}`,
        // `attachments/${cleanPath}`,
        // cleanPath.replace(/\s+/g, '_'),
        // cleanPath.replace(/\s+/g, '-'),
        // cleanPath.replace(/Pasted image (\d{8})(\d{6})\.png/i, 'Pasted_image_$1_$2.png'),
        // cleanPath.replace(/Pasted image (\d{8})(\d{6})\.png/i, 'Pasted-image-$1-$2.png')
      ];

      try {
        const url = await client.asyncSignatureUrl(`images/${cleanPath}`, {
          expires: 3600,
        });
        console.log("Found image at:", `${url}`);
        return NextResponse.json({ url });
      } catch (err) {
        console.log("Path not found:", `images/${cleanPath}`, err);
      }
    }

    // Check if it's a valid image extension
    const imageExtensions = [
      ".png",
      ".jpg",
      ".jpeg",
      ".gif",
      ".svg",
      ".webp",
      ".bmp",
      ".tiff",
    ];
    const hasValidExtension = imageExtensions.some((ext) =>
      cleanPath.toLowerCase().endsWith(ext),
    );

    if (!hasValidExtension) {
      console.log("Invalid image format:", cleanPath);

      // Try to find the file with common extensions
      for (const ext of imageExtensions) {
        const testPath = cleanPath + ext;
        try {
          const testUrl = await client.asyncSignatureUrl(testPath, {
            expires: 3600,
          });
          console.log("Found image with added extension:", testPath);
          return NextResponse.json({ url: testUrl });
        } catch {
          // Continue to next extension
        }
      }

      return NextResponse.json(
        { error: "Invalid image format" },
        { status: 400 },
      );
    }

    // Add /images/ prefix if not already present
    if (!cleanPath.startsWith("images/")) {
      cleanPath = `images/${cleanPath}`;
    }
    console.log("Final clean path:", cleanPath);

    // Generate presigned URL using ali-oss
    const url = await client.asyncSignatureUrl(cleanPath, {
      expires: 3600, // URL expires in 1 hour
    });

    console.log("Generated URL:", url);
    return NextResponse.json({ url });
  } catch (error) {
    console.error("Error getting image URL:", error);
    return NextResponse.json(
      {
        error: "Failed to get image URL",
        details: error instanceof Error ? error.message : String(error),
        path: imagePath,
      },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  try {
    const { imagePath } = await req.json();

    if (!imagePath) {
      return NextResponse.json(
        { error: "Image path is required" },
        { status: 400 },
      );
    }

    // Initialize OSS client using environment variables
    const client = new OSS({
      accessKeyId: process.env.AWS_ACCESS_KEY_ID as string,
      accessKeySecret: process.env.AWS_SECRET_ACCESS_KEY as string,
      bucket: process.env.AWS_S3_BUCKET_NAME_NOTEBOOK_CHUNK as string,
      region: process.env.AWS_REGION as string,
      secure: true,
    });

    let cleanPath = imagePath.replace(/^\/+/, "");

    // Check if it's a valid image extension
    const imageExtensions = [
      ".png",
      ".jpg",
      ".jpeg",
      ".gif",
      ".svg",
      ".webp",
      ".bmp",
      ".tiff",
    ];
    const hasValidExtension = imageExtensions.some((ext) =>
      cleanPath.toLowerCase().endsWith(ext),
    );

    if (!hasValidExtension) {
      return NextResponse.json(
        { error: "Invalid image format" },
        { status: 400 },
      );
    }

    // Add /images/ prefix if not already present
    if (!cleanPath.startsWith("images/")) {
      cleanPath = `images/${cleanPath}`;
    }

    // Generate presigned URL using ali-oss
    const url = await client.asyncSignatureUrl(cleanPath, {
      expires: 3600, // URL expires in 1 hour
      response: {
        "content-type": "image/*",
      },
    });
    console.log("url: ", url);

    return NextResponse.json({ url });
  } catch (error) {
    console.error("Error getting image URL:", error);
    return NextResponse.json(
      { error: "Failed to get image URL" },
      { status: 500 },
    );
  }
}
