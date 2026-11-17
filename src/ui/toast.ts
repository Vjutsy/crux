let timer: ReturnType<typeof setTimeout> | undefined;

export function toast(text: string, ms = 2400) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = text;
  el.classList.add('on');
  clearTimeout(timer);
  timer = setTimeout(() => el.classList.remove('on'), ms);
}
