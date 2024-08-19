import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class SharedAuthGuard extends AuthGuard('shared-auth') {}
