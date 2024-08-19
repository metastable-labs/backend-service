import { Request } from 'express';
import { User } from '../../modules/user/entities/user.entity';
import { SharedUser } from 'src/modules/shared/entities/user.entity';

export interface AuthRequest extends Request {
  user: User;
}

export interface SharedAuthRequest extends Request {
  user: SharedUser;
}
