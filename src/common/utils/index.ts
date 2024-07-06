import * as moment from 'moment';
import {
  DateRange,
  PeriodKey,
  PeriodType,
} from '../helpers/analytic/interfaces/analytic.interface';
import { ServiceError } from '../errors/service.error';
import { HttpStatus, ValidationError } from '@nestjs/common';
import { Period } from '../helpers/analytic/enums/analytic.enum';

export const getEnvPath = () => {
  const env: string | undefined = process.env.NODE_ENV;
  const envPath = `${process.cwd()}/.env${env ? '.' + env : '.local'}`;

  return envPath;
};

export const generateCode = (length = 8) => {
  const characters =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let code = '';

  for (let i = 0; i < length; i++) {
    const randomIndex = Math.floor(Math.random() * characters.length);
    code += characters[randomIndex];
  }

  return code;
};

export const getDates = (
  duration: PeriodType,
  startDate: Date,
  endDate: Date,
): moment.Moment[] => {
  const start = moment(startDate);
  const end = moment(endDate);
  const dates: moment.Moment[] = [];

  const current = start.clone();

  while (current.isSameOrBefore(end)) {
    dates.push(current.clone());
    current.add(1, duration);
  }

  return dates;
};

export const getDateRangeFromKey = (key: PeriodKey): DateRange => {
  const now = new Date();
  let startDate: Date;

  switch (key) {
    case '1h':
      startDate = new Date(now.getTime() - 60 * 60 * 1000); // 1 hour ago
      break;
    case '24h':
      startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000); // 24 hours ago
      break;
    case '1w':
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000); // 1 week ago
      break;
    case '1m':
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000); // Approximately 1 month ago
      break;
    default:
      throw new ServiceError('Invalid period', HttpStatus.BAD_REQUEST);
  }

  return {
    startDate,
    endDate: now,
  };
};

export const getPeriod = (periodKey: PeriodKey) => {
  const periodMap: { [K in PeriodKey]: Period } = {
    '1h': Period.Minute,
    '24h': Period.Hour,
    '1w': Period.Day,
    '1m': Period.Week,
  };

  return periodMap[periodKey];
};

export const flattenValidationErrors = (
  errors: ValidationError[],
): string[] => {
  return errors.reduce((acc, error) => {
    if (error.constraints) {
      return [...acc, ...Object.values(error.constraints)];
    }
    if (error.children) {
      return [...acc, ...flattenValidationErrors(error.children)];
    }
    return acc;
  }, [] as string[]);
};
