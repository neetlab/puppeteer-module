const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const RESOLVABLE = /main_process\/(.+?)$/;

(async () => {
  const browser = await puppeteer.launch();
  const page    = await browser.newPage();

  // Enable Request Introspection
  await page.setRequestInterception(true);

  // Spy on requests starts with `main_process://`
  page.on('request', async req => {
    if (!RESOLVABLE.test(req.url())) {
      return req.continue();
    }

    const [, filename] = req.url().match(RESOLVABLE);
    const dir = path.join(process.cwd(), filename);
    const data = fs.readFileSync(require.resolve(dir));

    return req.respond({
      contentType: 'application/javascript',
      body: data,
    });
  });

  await page.goto('https://google.com');

  // Embed JavaScript
  await page.addScriptTag({ type: 'module', content: `
    import { HELLO } from '/main_process/src/demo';
    window.data = HELLO;
  `});

  await page.waitFor(1000);
  
  // Alternativly, you can wait for global variable to be declared
  // by using waitForFunction
  await page.waitForFunction(_ => window.data);

  const data = await page.evaluate(_ => window.data);
  console.log(`Data: ${data}`);

  await page.close();
  await browser.close();
})();
