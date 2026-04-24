const puppeteer = require('puppeteer'); // v23.0.0 or later

(async () => {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    const timeout = 5000;
    page.setDefaultTimeout(timeout);

    {
        const targetPage = page;
        await targetPage.setViewport({
            width: 960,
            height: 771
        })
    }
    {
        const targetPage = page;
        await targetPage.goto('https://ibi-gooch.com/groups/1');
    }
    {
        const targetPage = page;
        await puppeteer.Locator.race([
            targetPage.locator('div.bg-card\\/30 button:nth-of-type(1)'),
            targetPage.locator('::-p-xpath(//*[@id=\\"root\\"]/div[1]/main/div[1]/div/button[1])'),
            targetPage.locator(':scope >>> div.bg-card\\/30 button:nth-of-type(1)')
        ])
            .setTimeout(timeout)
            .click({
              offset: {
                x: 12,
                y: 12,
              },
            });
    }
    {
        const targetPage = page;
        await puppeteer.Locator.race([
            targetPage.locator('main button:nth-of-type(2)'),
            targetPage.locator('::-p-xpath(//*[@id=\\"root\\"]/div[1]/main/div[1]/div[1]/button[2])'),
            targetPage.locator(':scope >>> main button:nth-of-type(2)')
        ])
            .setTimeout(timeout)
            .click({
              offset: {
                x: 11,
                y: 13,
              },
            });
    }
    {
        const targetPage = page;
        await puppeteer.Locator.race([
            targetPage.locator('button:nth-of-type(2)'),
            targetPage.locator('::-p-xpath(//*[@id=\\"root\\"]/div[1]/main/div[1]/div[1]/button[2])'),
            targetPage.locator(':scope >>> button:nth-of-type(2)')
        ])
            .setTimeout(timeout)
            .click({
              offset: {
                x: 11,
                y: 13,
              },
            });
    }
    {
        const targetPage = page;
        await puppeteer.Locator.race([
            targetPage.locator('div.bg-card\\/30 > div.items-center > button:nth-of-type(1)'),
            targetPage.locator('::-p-xpath(//*[@id=\\"root\\"]/div[1]/main/div[1]/div[1]/button[1])'),
            targetPage.locator(':scope >>> div.bg-card\\/30 > div.items-center > button:nth-of-type(1)')
        ])
            .setTimeout(timeout)
            .click({
              count: 2,
              offset: {
                x: 15,
                y: 8,
              },
            });
    }
    {
        const targetPage = page;
        await puppeteer.Locator.race([
            targetPage.locator('div.bg-card\\/30 > div.items-center > button:nth-of-type(1)'),
            targetPage.locator('::-p-xpath(//*[@id=\\"root\\"]/div[1]/main/div[1]/div[1]/button[1])'),
            targetPage.locator(':scope >>> div.bg-card\\/30 > div.items-center > button:nth-of-type(1)')
        ])
            .setTimeout(timeout)
            .click({
              count: 2,
              offset: {
                x: 10,
                y: 17,
              },
            });
    }
    {
        const targetPage = page;
        await targetPage.keyboard.down('Meta');
    }
    {
        const targetPage = page;
        const promises = [];
        const startWaitingForEvents = () => {
            promises.push(targetPage.waitForNavigation());
        }
        await targetPage.keyboard.down('r');
        await Promise.all(promises);
    }
    {
        const targetPage = page;
        await puppeteer.Locator.race([
            targetPage.locator('div.bg-card\\/30 button:nth-of-type(1)'),
            targetPage.locator('::-p-xpath(//*[@id=\\"root\\"]/div[1]/main/div[1]/div/button[1])'),
            targetPage.locator(':scope >>> div.bg-card\\/30 button:nth-of-type(1)')
        ])
            .setTimeout(timeout)
            .click({
              offset: {
                x: 13,
                y: 8,
              },
            });
    }
    {
        const targetPage = page;
        await puppeteer.Locator.race([
            targetPage.locator('div.bg-card\\/30 > div.items-center > button:nth-of-type(1)'),
            targetPage.locator('::-p-xpath(//*[@id=\\"root\\"]/div[1]/main/div[1]/div[1]/button[1])'),
            targetPage.locator(':scope >>> div.bg-card\\/30 > div.items-center > button:nth-of-type(1)')
        ])
            .setTimeout(timeout)
            .click({
              offset: {
                x: 15,
                y: 14,
              },
            });
    }
    {
        const targetPage = page;
        await puppeteer.Locator.race([
            targetPage.locator('div.bg-card\\/30 > div.items-center > button:nth-of-type(1)'),
            targetPage.locator('::-p-xpath(//*[@id=\\"root\\"]/div[1]/main/div[1]/div[1]/button[1])'),
            targetPage.locator(':scope >>> div.bg-card\\/30 > div.items-center > button:nth-of-type(1)')
        ])
            .setTimeout(timeout)
            .click({
              offset: {
                x: 17,
                y: 13,
              },
            });
    }
    {
        const targetPage = page;
        await targetPage.keyboard.down('Meta');
    }
    {
        const targetPage = page;
        const promises = [];
        const startWaitingForEvents = () => {
            promises.push(targetPage.waitForNavigation());
        }
        await targetPage.keyboard.down('r');
        await Promise.all(promises);
    }
    {
        const targetPage = page;
        await puppeteer.Locator.race([
            targetPage.locator('div.bg-card\\/30 button:nth-of-type(1)'),
            targetPage.locator('::-p-xpath(//*[@id=\\"root\\"]/div[1]/main/div[1]/div/button[1])'),
            targetPage.locator(':scope >>> div.bg-card\\/30 button:nth-of-type(1)')
        ])
            .setTimeout(timeout)
            .click({
              offset: {
                x: 13,
                y: 17,
              },
            });
    }

    await browser.close();

})().catch(err => {
    console.error(err);
    process.exit(1);
});
