import { v2 as cloudinary } from 'cloudinary';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export function generateSignature(params: {
  folder: string;
  resourceType: string;
}): {
  signature: string;
  timestamp: number;
  apiKey: string;
  cloudName: string;
  folder: string;
} {
  const timestamp = Math.round(Date.now() / 1000);
  const paramsToSign = { folder: params.folder, timestamp };
  const signature = cloudinary.utils.api_sign_request(
    paramsToSign,
    process.env.CLOUDINARY_API_SECRET!
  );
  return {
    signature,
    timestamp,
    apiKey: process.env.CLOUDINARY_API_KEY!,
    cloudName: process.env.CLOUDINARY_CLOUD_NAME!,
    folder: params.folder,
  };
}

export async function deleteMedia(cloudinaryId: string, resourceType: string): Promise<void> {
  const type: 'image' | 'video' | 'raw' = resourceType === 'IMAGE' ? 'image' : resourceType === 'VIDEO' ? 'video' : 'raw';
  await cloudinary.uploader.destroy(cloudinaryId, { resource_type: type });
}
