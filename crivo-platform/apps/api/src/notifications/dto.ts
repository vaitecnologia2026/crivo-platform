import { IsBoolean, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateNotificationSettingDto {
  @IsOptional() @IsBoolean()
  emailEnabled?: boolean;

  @IsOptional() @IsBoolean()
  pushEnabled?: boolean;
}

export class RegisterPushTokenDto {
  @IsString() @MaxLength(4096)
  token!: string;

  @IsIn(['ios', 'android', 'web'])
  platform!: 'ios' | 'android' | 'web';
}
