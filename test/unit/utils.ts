export async function timeout(ms = 1): Promise<void> {
  return new Promise(resolve => {
    setTimeout(resolve, ms);
  });
}
