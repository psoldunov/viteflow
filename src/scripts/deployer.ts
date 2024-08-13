import axios from "axios";
import crypto from "crypto";
import fs from "fs";
import FormData from "form-data";
import { join } from "path";

// Define a more flexible type for uploadDetails
type UploadDetails = {
  [key: string]: string;
  acl: string;
  bucket: string;
  "X-Amz-Algorithm": string;
  "X-Amz-Credential": string;
  "X-Amz-Date": string;
  key: string;
  Policy: string;
  "X-Amz-Signature": string;
  success_action_status: string;
  "content-type": string;
  "Cache-Control": string;
};

interface AssetData {
  uploadDetails: UploadDetails;
  uploadUrl: string;
}

async function getFileMD5(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash("md5");
    const stream = fs.createReadStream(filePath);

    stream.on("data", (data) => {
      hash.update(data);
    });

    stream.on("end", () => {
      resolve(hash.digest("hex"));
    });

    stream.on("error", (err) => {
      reject(err);
    });
  });
}

async function uploadFile(
  assetData: AssetData,
  filePath: string,
): Promise<void> {
  const form = new FormData();

  const { uploadDetails, uploadUrl } = assetData;

  Object.keys(uploadDetails).forEach((key) => {
    form.append(key, uploadDetails[key]);
  });

  form.append("file", fs.createReadStream(filePath));

  try {
    const response = await axios.post(uploadUrl, form, {
      headers: {
        ...form.getHeaders(),
      },
    });

    if (response.status === 201) {
      console.log("File uploaded successfully!");
    } else {
      console.error("Failed to upload file:", response.status, response.data);
    }
  } catch (error) {
    console.error("Error uploading file:", error);
  }
}

export default async function startDeploy(): Promise<void> {
  const token: string = process.env.WEBFLOW_API_TOKEN || "";
  const siteId: string = process.env.WEBFLOW_SITE_ID || "";

  if (!token || !siteId) {
    console.error(
      "Please set WEBFLOW_API_TOKEN and WEBFLOW_SITE_ID in the configuration file.",
    );
    process.exit(1);
  }

  const bundleFilePath = join(process.cwd(), "/dist/main.js");

  try {
    const fileHash = await getFileMD5(bundleFilePath);

    const options = {
      method: "POST",
      url: `https://api.webflow.com/v2/sites/${siteId}/assets`,
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
      },
      data: {
        fileName: "main.js.txt",
        fileHash: fileHash, // Using the awaited hash value here
      },
    };

    const response = await axios.request(options);

    const data: AssetData = response.data; // No need to parse if the response is already JSON

    // Check if file exists before attempting to upload
    if (!fs.existsSync(bundleFilePath)) {
      console.error("File not found:", bundleFilePath);
      process.exit(1);
    }

    // Upload the file
    await uploadFile(data, bundleFilePath);
  } catch (error) {
    console.error("Error in deployment:", error);
  }
}
