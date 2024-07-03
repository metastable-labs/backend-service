import * as fileType from 'file-type-mime';
import { FileValidator } from '@nestjs/common';

export interface CustomUploadTypeValidatorOptions {
  fileType: string[];
}

export class CustomUploadFileTypeValidator extends FileValidator {
  private _allowedMimeTypes: string[];

  constructor(
    protected readonly validationOptions: CustomUploadTypeValidatorOptions,
  ) {
    super(validationOptions);
    this._allowedMimeTypes = this.validationOptions.fileType;
  }

  public isValid(file: Express.Multer.File): boolean {
    const response = fileType.parse(file.buffer);
    return this._allowedMimeTypes.includes(
      (response?.mime || file.mimetype) as string,
    );
  }

  public buildErrorMessage(): string {
    return `Upload not allowed. Upload only files of type: ${this._allowedMimeTypes.join(
      ', ',
    )}`;
  }
}

import { ParseFilePipe, PipeTransform } from '@nestjs/common';

export class ParseFilesPipe implements PipeTransform<Express.Multer.File[]> {
  constructor(private readonly pipe: ParseFilePipe) {}

  async transform(
    files: Express.Multer.File[] | { [key: string]: Express.Multer.File },
  ): Promise<Express.Multer.File[] | { [key: string]: Express.Multer.File }> {
    if (Array.isArray(files)) {
      await Promise.all(files.map((file) => this.pipe.transform(file)));
      return files;
    } else {
      await Promise.all(
        Object.values(files).map((file) => this.pipe.transform(file)),
      );
      return files;
    }
  }
}
