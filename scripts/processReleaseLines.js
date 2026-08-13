import fs from 'fs';
import path from 'path';
import { OmdbService } from '../src/services/omdbService.js';

const lines = [
	`Alliance S01 E24 Week 3 Recap 720p WEB-DL Hindi ESubs`,
	`Alliance S01 E23 720p WEB-DL Hindi ESubs`,
	`Alliance S01 E22 720p WEB-DL Hindi ESubs`,
	`Alliance S01 E21 720p WEB-DL Hindi ESubs`,
	`Alliance S01 E20 720p WEB-DL Hindi ESubs`,
	`Alliance S01 E19 720p WEB-DL Hindi ESubs`,
	`Alliance S01 E18 720p WEB-DL Hindi ESubs`,
	`Alliance S01 E17 720p WEB-DL Hindi ESubs`,
	`Alliance S01 E16 Week 2 Recap 720p WEB-DL Hindi ESubs`,
	`Alliance S01 E15 720p WEB-DL Hindi ESubs`,
	`Alliance S01 E05 720p WEB-DL Hindi ESubs`,
	`Alliance S01 E04 720p WEB-DL Hindi ESubs`,
	`Alliance S01 E03 720p WEB-DL Hindi ESubs`,
	`Alliance S01 E02 720p WEB-DL Hindi ESubs`,
	`Alliance S01 E01 720p WEB-DL Hindi ESubs`,

	`Skins S07E06 Rise Part 2 480p AMZN WEB DL Dual Audio AAC 2 0 H26`,
	`Skins S07E05 Rise Part 1 480p AMZN WEB DL Dual Audio AAC 2 0 H26`,
	`Skins S07E04 Pure Part 2 480p AMZN WEB DL Dual Audio AAC 2 0 H26`,
	`Skins S07E03 Pure Part 1 480p AMZN WEB DL Dual Audio AAC 2 0 H26`,
	`Skins S07E02 Fire Part 2 480p AMZN WEB DL Dual Audio AAC 2 0 H26`,

	`My Life With the Walter Boys S03 E01 480p WEB DL Hindi English E`,

	`Chum 2026 1080p WEB-DL Multi Audio ESub x264`,
	`Chum 2026 720p WEB-DL Multi Audio ESub x264`,
	`Chum 2026 480p WEB-DL Multi Audio ESub x264`,
	`45 2025 720p DS4K WEB-DL Hindi 5 1-Kannada 5 1 ESub x264`,
	`45 2025 720p 10Bit DS4K WEB-DL Hindi 5 1-Kannada HEVC x265`,
	`45 2025 480p DS4K WEB-DL Hindi-Kannada ESub x264`,
	`A Madea Homecoming 2022 720p WEB-DL Hindi English ESub x264`,
	`A Madea Homecoming 2022 480p WEB-DL Hindi English ESub x264`,
	`Prem Prakaran 2022 720p WEB-DL Gujurati AAC2 0 x264`,

	`A Shop for Killers S02E06 The Trojan Horse 720p WEB DL English K`,
	`A Shop for Killers S02E05 Negotiation 720p WEB DL English Korean`,
	`A Shop for Killers S02E04 Raid 720p WEB DL English Korean ESub x`,
	`A Shop for Killers S02E03 Past Is Past`,

	`Ek Thi Begum S02E12 The Final Chapter 480p AMZN WEB DL Hindi AAC`,
	`Ek Thi Begum S02E11 Brutal Truth 480p AMZN WEB DL Hindi AAC 2 0`,
	`Ek Thi Begum S02E10 Shadows Of Past 480p AMZN WEB DL Hindi AAC 2`,
	`Ek Thi Begum S02E09 A Deadly Encounter 480p AMZN WEB DL Hindi AA`,
	`Ek Thi Begum S02E08 The Game Begins 480p AMZN WEB DL Hindi AAC 2`,
	`Ek Thi Begum S02E07 Meeting The Devil 480p AMZN WEB DL Hindi AAC`,
	`Ek Thi Begum S02E06 Biggest Deal 480p AMZN WEB DL Hindi AAC 2 0`,
	`Ek Thi Begum S02E05 Hunter s Hunt 480p AMZN WEB DL Hindi AAC 2 0`,
];

(async () => {
	const svc = new OmdbService(null, { omdbApiKey: 'trilogy' });
	console.log(`Fetching metadata for ${lines.length} release lines...`);
	const results = await svc.fetchBatchFromReleaseLines(lines, 4);
	const outPath = path.join(process.cwd(), 'scripts', 'release_lines_output.json');
	fs.writeFileSync(outPath, JSON.stringify(results, null, 2), 'utf8');
	console.log(`Wrote results to ${outPath}`);
})();
