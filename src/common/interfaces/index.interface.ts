export interface EncryptedData {
  iv: string;
  encryptedText: string;
  salt: string;
  authTag: string;
}
