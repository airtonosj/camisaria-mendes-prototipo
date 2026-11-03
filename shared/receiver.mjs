// A InfiniteTag é exibida como `$nome`, mas a API da InfinitePay recebe o handle sem
// o `$`. A mesma regra formata o campo enquanto se digita e valida no servidor.
export const infinitePayHandlePattern = /^[a-z0-9._-]{2,64}$/;

export function normalizeInfinitePayHandle(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/^\s*\$+/, '')
    .replace(/[^a-z0-9._-]/g, '')
    .slice(0, 64);
}

export function validInfinitePayHandle(value) {
  return infinitePayHandlePattern.test(String(value ?? ''));
}
