import { Global, Module } from "@nestjs/common";
import { KmsEncryptionService } from "./kms-encryption.service";

@Global()
@Module({
  providers: [KmsEncryptionService],
  exports: [KmsEncryptionService],
})
export class CryptoModule {}
