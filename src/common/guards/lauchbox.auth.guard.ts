import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class LaunchboxAuthGuard extends AuthGuard('launchbox-auth') {}
