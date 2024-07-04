import { Request } from 'express';
import { User } from '../../modules/user/entities/user.entity';
import { LaunchboxUser } from '../../modules/launchbox/entities/launchbox.entity';

export interface AuthRequest extends Request {
  user: User;
}

export interface LaunchboxAuthRequest extends Request {
  user: LaunchboxUser;
}
