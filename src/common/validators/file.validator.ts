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
