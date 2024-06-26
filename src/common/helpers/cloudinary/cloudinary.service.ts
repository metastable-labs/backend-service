import { Injectable } from '@nestjs/common';
import { v2 } from 'cloudinary';
import { env } from '../../config/env';

v2.config({
  cloud_name: env.cloudinary.cloudName,
  api_key: env.cloudinary.apiKey,
  api_secret: env.cloudinary.apiSecret,
  secure: true,
});

@Injectable()
export class CloudinaryService {
  public async upload(
    file: Express.Multer.File,
    folder = 'migrations',
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      v2.uploader
        .upload_stream({ resource_type: 'image', folder }, (error, result) => {
          if (error) {
            reject(error);
          }

          if (result && result.url) {
            resolve(result.secure_url);
          } else {
            reject('Upload failed');
          }
        })
        .end(file.buffer);
    });
  }

  public async convertToSvg(file: Express.Multer.File): Promise<string> {
    const url = await this.upload(file);

    if (url.endsWith('.svg')) {
      return url;
    }

    return v2.image(url, { format: 'svg' });
  }
}
