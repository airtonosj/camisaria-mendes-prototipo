/** Separate migration credentials; never mutate the application's environment. */
export function migrationDatabase(database, environment=process.env) {
  const user=environment.MIGRATION_DB_USER?.trim();
  const password=environment.MIGRATION_DB_PASSWORD;
  if(Boolean(user)!==Boolean(password))throw new Error('MIGRATION_DB_USER e MIGRATION_DB_PASSWORD devem ser informadas juntas.');
  return {...database,...(user?{user,password}:{})};
}
export function migrationsOnStart(environment=process.env) {
  const value=(environment.MIGRATIONS_ON_START??'true').trim().toLowerCase();
  if(['true','1','yes','on'].includes(value))return true;
  if(['false','0','no','off'].includes(value))return false;
  throw new Error('MIGRATIONS_ON_START inválida. Use true ou false.');
}
