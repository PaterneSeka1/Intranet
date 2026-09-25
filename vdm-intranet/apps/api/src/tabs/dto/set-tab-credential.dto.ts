import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator'

// Pas de contrainte de complexité (cf. PASSWORD_COMPLEXITY_REGEX) : il s'agit du mot de passe
// réel d'un site tiers partagé entre utilisateurs, pas d'un compte émis par VdM Intranet — lui
// imposer notre politique interne serait incorrect.
export class SetTabCredentialDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  username!: string

  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  password!: string

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string
}
