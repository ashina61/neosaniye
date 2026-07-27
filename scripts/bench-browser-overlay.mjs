import { chromium } from 'playwright-core';
import { readFile } from 'node:fs/promises';
const html = await readFile('frame.html','utf8');
const t0 = Date.now();
const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--no-sandbox','--disable-gpu'],
});
const page = await browser.newPage({ viewport:{width:1080,height:1920}, deviceScaleFactor:1 });
const boot = Date.now()-t0;
await page.setContent(html, { waitUntil:'load' });
const times=[];
for (let i=0;i<30;i++){
  const s=Date.now();
  // Her karede farklı bir durum: satırların görünürlüğünü değiştir
  await page.evaluate((n)=>{document.querySelectorAll('li').forEach((el,k)=>{el.style.visibility=k<=n?'visible':'hidden';});}, i%3);
  await page.screenshot({ path:`f${i}.png`, omitBackground:true });
  times.push(Date.now()-s);
}
await browser.close();
times.sort((a,b)=>a-b);
console.log('tarayıcı açılış:', boot,'ms');
console.log('kare başına  : medyan', times[15],'ms | min', times[0],'| max', times[29]);
console.log('30 kare toplam:', times.reduce((a,b)=>a+b,0),'ms');
const perFrame=times[15];
console.log('---');
console.log('40sn @30fps (1200 kare) tam kare kare:', ((boot+perFrame*1200)/1000/60).toFixed(1),'dakika');
console.log('10 sahne x 3 durum (30 PNG)         :', ((boot+perFrame*30)/1000).toFixed(1),'saniye');
