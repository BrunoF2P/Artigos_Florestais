import { createClient } from "@supabase/supabase-js";
import Papa from "papaparse";
import { splitCombined } from "../../../../../../Documentos/Desenvolvimento/Artigos_Florestais/src/lib/importer.js";

const supabaseUrl = "https://yynizaxolzedvkhvrmse.supabase.co";
const supabaseKey = "sb_publishable_vtO-pX2gKaTDFiZ7VlMjSg_IkG4zQ8w";
const supabase = createClient(supabaseUrl, supabaseKey);

// The headers in Scopus export format:
const headers = [
  "Authors", "Author full names", "Author(s) ID", "Title", "Year", "Source title",
  "Volume", "Issue", "Art. No.", "Page start", "Page end", "Page count", "Cited by",
  "DOI", "Link", "Affiliations", "Authors with affiliations", "Abstract",
  "Author Keywords", "Index Keywords", "References", "Correspondence Address",
  "Editors", "Publisher", "ISSN", "ISBN", "CODEN", "PubMed ID", "Language of Original Document",
  "Abbreviated Source Title", "Document Type", "Publication Stage", "Open Access",
  "Source", "EID"
];

// The TSV rows pasted by the user:
const rawData = `Kihagi G.W.; Kurniawan A.L.; Agure E.; Muok E.M.O.; Sorgho R.; Danquah I.\tKihagi, Grace Wothaya (58622261100); Kurniawan, Adi Lukas (57208399056); Agure, Erick (57703210300); Muok, Erick M.O. (60077866500); Sorgho, Raissa (57191627480); Danquah, Ina (22956801000)\t58622261100; 57208399056; 57703210300; 60077866500; 57191627480; 22956801000\tReduced rank regression-derived dietary patterns related to climate-sensitive micronutrients and their associations with child undernutrition among young children in rural Kenya: findings from the ALIMUS study\t2026\tBMC Public Health\t26\t1\t348\t\t\t0\t10.1186/s12889-026-26265-z\thttps://www.scopus.com/pages/publications/105028879460?origin=resultslist\tHeidelberg Institute of Global Health (HIGH), Medical Faculty and University Hospital, Heidelberg University, Heidelberg, Germany; Transdisciplinary Research Area (TRA) “Technology and Innovation for Sustainable Futures” and Center for Development Research (ZEF), Rheinische Friedrich-Wilhelms University of Bonn, Beringstrasse 1, Bonn, 53115, Germany; Kenya Medical Research Institute (KEMRI), Center for Global Health Research (CGHR), Kisumu, Kenya; Public Health Institute (PHI), Center for Wellness and Nutrition (CWN), Sacramento, CA, United States\tKihagi G.W., Heidelberg Institute of Global Health (HIGH), Medical Faculty and University Hospital, Heidelberg University, Heidelberg, Germany, Transdisciplinary Research Area (TRA) “Technology and Innovation for Sustainable Futures” and Center for Development Research (ZEF), Rheinische Friedrich-Wilhelms University of Bonn, Beringstrasse 1, Bonn, 53115, Germany; Kurniawan A.L., Heidelberg Institute of Global Health (HIGH), Medical Faculty and University Hospital, Heidelberg University, Heidelberg, Germany, Transdisciplinary Research Area (TRA) “Technology and Innovation for Sustainable Futures” and Center for Development Research (ZEF), Rheinische Friedrich-Wilhelms University of Bonn, Beringstrasse 1, Bonn, 53115, Germany; Agure E., Transdisciplinary Research Area (TRA) “Technology and Innovation for Sustainable Futures” and Center for Development Research (ZEF), Rheinische Friedrich-Wilhelms University of Bonn, Beringstrasse 1, Bonn, 53115, Germany; Muok E.M.O., Kenya Medical Research Institute (KEMRI), Center for Global Health Research (CGHR), Kisumu, Kenya; Sorgho R., Transdisciplinary Research Area (TRA) “Technology and Innovation for Sustainable Futures” and Center for Development Research (ZEF), Rheinische Friedrich-Wilhelms University of Bonn, Beringstrasse 1, Bonn, 53115, Germany, Public Health Institute (PHI), Center for Wellness and Nutrition (CWN), Sacramento, CA, United States; Danquah I., Heidelberg Institute of Global Health (HIGH), Medical Faculty and University Hospital, Heidelberg University, Heidelberg, Germany, Transdisciplinary Research Area (TRA) “Technology and Innovation for Sustainable Futures” and Center for Development Research (ZEF), Rheinische Friedrich-Wilhelms University of Bonn, Beringstrasse 1, Bonn, 53115, Germany\tBackground: Undernutrition among children remains a global public health challenge in sub-Saharan Africa. This study examined the associations of dietary patterns related to climate-sensitive micronutrients with undernutrition among children aged 6–23 months in Siaya County, Kenya. Methods: We used cross-sectional baseline data of 626 mother-child pairs from a cluster-randomized controlled trial on nutrition counselling and home gardening. Dietary patterns and food intake were derived from a semi-quantitative food frequency questionnaire and identified using Reduced-Rank Regression (RRR) with the response variables of iron, zinc, selenium, and vitamin A (climate-sensitive micronutrients). Their associations with anthropometric z-scores [weight-for-age (WAZ), weight-for-height (WHZ), height-for-age (HAZ)] were calculated by regression models. Results: In this study population (median age: 15 months; 54.2% boys), boys had a lower median of WAZ (-0.47 vs. -0.20), WHZ (-0.02 vs. 0.18), and HAZ (-0.88 vs. -0.54) than girls (p < 0.05). RRR-derived dietary patterns were similar between boys and girls, explaining 68% and 65% of the variations in micronutrient intakes, respectively. These patterns, characterized by high consumption of vegetables, fish, potatoes, coffee and tea, white bread and cereals, fruits, rice and pasta, fermented food, and legumes, were positively associated with WAZ and WHZ but not with HAZ, only among girls. Conclusion: A diet rich in protein sources and fruits and vegetables is associated with better general and acute nutritional status among young girls in rural Kenya. © The Author(s) 2026.\tChildren; Climate-sensitive micronutrients; Dietary pattern; Reduced rank regression; Undernutrition\ttrace element; article; child; climate; dietary pattern; drug therapy; etiology; female; human; major clinical study; malnutrition; preschool child; prevention\tAkombi B.J.; Agho K.E.; Merom D.; Renzaho A.M.; Hall J.J., Child malnutrition in sub-Saharan Africa: a meta-analysis of demographic and health surveys (2006–2016), PLoS One, 12, (2017); Leroy J.L.; Ruel M.; Habicht J.P.; Frongillo E.A., Linear growth deficit continues to accumulate beyond the first 1000 days in low- and middle-income countries: global evidence from 51 national surveys, J Nutr, 144, pp. 1460-1466, (2014); Tesema G.A.; Yeshaw Y.; Worku M.G.; Tessema Z.T.; Teshale A.B., Pooled prevalence and associated factors of chronic undernutrition among under-five children in East Africa: a multilevel analysis, PLoS One, 16, (2021); Situation Analysis of Children and Women in Kenya, (2017); Mirzabaev A.; Kerr R.B.; Hasegawa T.; Pradhan P.; Wreford A.; von der Pahlen M.C.T., Severe climate change risks to food security and nutrition, Clim Risk Manag, 39, (2023); Ray D.K.; West P.C.; Clark M.; Gerber J.S.; Prishchepov A.V.; Chatterjee S., Climate change has likely already affected global food production, PLoS One, 14, (2019); Adhikari U.; Nejadhashemi A.P.; Woznicki S.A., Climate change and Eastern Africa: a review of impact on major crops, Food Energy Secur, 4, pp. 110-132, (2015)\tA.L. Kurniawan; Heidelberg Institute of Global Health (HIGH), Medical Faculty and University Hospital, Heidelberg University, Heidelberg, Germany; email: lukas.kurniawan@uni-bonn.de\t\tBioMed Central Ltd\t14712458\t\t\t41527108\tEnglish\tBMC Public Health\tArticle\tFinal\tAll Open Access; Gold Open Access; Green Open Access\tScopus\t2-s2.0-105028879460
Shole T.; Ayele A.; Geddafa T.\tShole, Tafese (60608884100); Ayele, Asaye (60609268100); Geddafa, Tale (57237454800)\t60608884100; 60609268100; 57237454800\tCommunity awareness, perceived impacts and local adaptation strategies toward climate change in Liben Chukala District, Ethiopia\t2026\tInternational Journal of Climate Change Strategies and Management\t18\t3\t\t1\t26\t0\t10.1108/IJCCSM-05-2025-0154\thttps://www.scopus.com/pages/publications/105037536036?origin=resultslist\tDepartment of Natural Resource Management, College of Agriculture and Veterinary Science, Ambo University, Ambo, Ethiopia; Department of Forestry, College of Agriculture and Veterinary Science, Ambo University, Ambo, Ethiopia; College of Agriculture and Veterinary Science, Ambo University, Ambo, Ethiopia\tShole T., Department of Natural Resource Management, College of Agriculture and Veterinary Science, Ambo University, Ambo, Ethiopia; Ayele A., Department of Forestry, College of Agriculture and Veterinary Science, Ambo University, Ambo, Ethiopia; Geddafa T., College of Agriculture and Veterinary Science, Ambo University, Ambo, Ethiopia\tPurpose – This study aims to assess community awareness, perceived impacts and adaptation strategies to climate change in Liben Chukala District, Ethiopia, focusing on the vulnerabilities of subsistence-farming households and identifying measures to strengthen local resilience.\tAdaptation strategies; Climate change; Community awareness; Ethiopia; Impacts\tEthiopia; adaptive management; agroforestry; climate change; climate effect; drought stress; local adaptation; perception; smallholder; soil erosion; spatiotemporal analysis; strategic approach\tAbate T., Understanding factors affecting livelihood strategies of firewood and charcoal producers in the dry lands of Ethiopia, (2021); Abukari A.B.T.; Bawa K.; Awuni J.A., Adoption determinants of agricultural extension communication channels in emergency and non-emergency situations in Ghana, Cogent Food and Agriculture, 7, 1, (2021); Admassie A.; Abebaw D., Ethiopia-land, climate, energy, agriculture and development: a study in the Sudano-Sahel initiative for regional development, jobs, and food security, (2021)\tT. Geddafa; College of Agriculture and Veterinary Science, Ambo University, Ambo, Ethiopia; email: gedefa44@gmail.com\t\tEmerald Publishing\t17568692\t\t\t\tEnglish\tInt. J. Clim. Change Strateg. Manage.\tArticle\tFinal\tAll Open Access; Gold Open Access\tScopus\t2-s2.0-105037536036
Simon A.; Bárdos H.\tSimon, Anita (60405195200); Bárdos, Helga (6602615344)\t60405195200; 6602615344\tHome gardening and fruit and vegetable intake in rural settlements in Northeast Hungary\t2026\tScientific Reports\t16\t1\t7903\t\t\t0\t10.1038/s41598-026-39593-2\thttps://www.scopus.com/pages/publications/105031746813?origin=resultslist\tDoctoral School of Health Sciences, University of Debrecen, Debrecen, Hungary; Department of Public Health and Epidemiology, Faculty of Medicine, University of Debrecen, Kassai u. 26, Debrecen, 4029, Hungary\tSimon A., Doctoral School of Health Sciences, University of Debrecen, Debrecen, Hungary; Bárdos H., Department of Public Health and Epidemiology, Faculty of Medicine, University of Debrecen, Kassai u. 26, Debrecen, 4029, Hungary\tSeveral studies have found that home gardening can impact fruit and vegetable intake. In Hungary, where fruit and vegetable consumption is among the lowest in the European Union (EU), poor diet is the main behavioral risk factor contributing to mortality. Therefore, this study explored the associations between home gardening and fruit and vegetable intake, as well as other health-related factors, in two rural settlements in Northeast Hungary.\tHungary; Northeast Hungary; Rural settlements; vegetable intake\tbehavioral risk factor; human; mortality; nutrition; risk factor; rural population\t\tT. Geddafa; College of Agriculture and Veterinary Science, Ambo University, Ambo, Ethiopia; email: gedefa44@gmail.com\t\tNature Publishing\t20452322\t\t\t\tEnglish\tSci. Rep.\tArticle\tFinal\tAll Open Access; Gold Open Access\tScopus\t2-s2.0-105031746813`;

// Assemble the TSV content
const fileContent = headers.join("\t") + "\n" + rawData;

// Parse TSV using PapaParse
const result = Papa.parse(fileContent, {
  header: true,
  delimiter: "\t",
  skipEmptyLines: true
});

console.log("Linhas parseadas com sucesso:", result.data.length);
if (result.errors.length > 0) {
  console.log("Erros no parser:", result.errors);
}

const PARSED = splitCombined(result.data);

console.log("Resumo dos dados mapeados:");
console.log("- Artigos:", PARSED.artigo.length);
console.log("- Autores:", PARSED.autor.length);
console.log("- Palavras-chave:", PARSED.palavra_chave.length);
console.log("- Referências:", PARSED.referencia.length);
console.log("- Open Access tipos:", PARSED.open_access_tipo.length);

// Helper function to insert in chunks
async function upsertInChunks(table, rows, conflictColumns) {
  for (let i = 0; i < rows.length; i += 500) {
    const chunk = rows.slice(i, i + 500);
    const { error } = await supabase
      .from(table)
      .upsert(chunk, { onConflict: conflictColumns });
    if (error) {
      console.error(`Erro upsert em ${table}:`, error);
      throw error;
    }
  }
}

async function runTest() {
  try {
    console.log("\n=== INICIANDO UPSERTS NO BANCO ===");

    // 1. Authors
    console.log("1. Inserindo autores...");
    await upsertInChunks("autor", PARSED.autor, "id");
    console.log("Autores inseridos com sucesso!");

    // 2. Open Access Types
    console.log("2. Inserindo tipos open access...");
    const oaMap = new Map();
    const uniqueTypes = [...new Set(PARSED.open_access_tipo.map(t => t.nome).filter(Boolean))];
    if (uniqueTypes.length > 0) {
      const rows = uniqueTypes.map(nome => ({ nome }));
      const { data, error } = await supabase
        .from("open_access_tipo")
        .upsert(rows, { onConflict: "nome", ignoreDuplicates: true })
        .select("id, nome");
      if (error) throw error;
      data.forEach(e => oaMap.set(e.nome.trim().toLowerCase(), e.id));
    }
    console.log("Tipos Open Access inseridos com sucesso!");

    // 3. Keywords
    console.log("3. Inserindo palavras-chave...");
    const kwMap = new Map();
    // Replicate case-insensitive check
    const inputKws = new Map();
    PARSED.palavra_chave.forEach(kw => {
      const key = kw.palavra.toLowerCase() + "_" + kw.tipo;
      if (!inputKws.has(key)) {
        inputKws.set(key, { palavra: kw.palavra, tipo: kw.tipo });
      }
    });
    const uniqueInputKws = Array.from(inputKws.values());
    const searchTerms = new Set();
    uniqueInputKws.forEach(kw => {
      searchTerms.add(kw.palavra);
      searchTerms.add(kw.palavra.toLowerCase());
      searchTerms.add(kw.palavra.toUpperCase());
    });
    const { data: dbKws, error: errKws } = await supabase
      .from("palavra_chave")
      .select("id, palavra, tipo")
      .in("palavra", Array.from(searchTerms));
    
    if (errKws) throw errKws;
    const existingKws = new Map();
    dbKws?.forEach(dbKw => {
      existingKws.set(dbKw.palavra.toLowerCase() + "_" + dbKw.tipo, dbKw.id);
    });

    const newKwsToInsert = uniqueInputKws.filter(kw => !existingKws.has(kw.palavra.toLowerCase() + "_" + kw.tipo));
    if (newKwsToInsert.length > 0) {
      const { data, error } = await supabase
        .from("palavra_chave")
        .insert(newKwsToInsert)
        .select("id, palavra, tipo");
      if (error) throw error;
      data.forEach(dbKw => {
        existingKws.set(dbKw.palavra.toLowerCase() + "_" + dbKw.tipo, dbKw.id);
      });
    }

    uniqueInputKws.forEach(kw => {
      const key = kw.palavra.toLowerCase() + "_" + kw.tipo;
      const dbId = existingKws.get(key);
      if (dbId !== undefined) {
        kwMap.set(kw.palavra.toLowerCase() + "_" + kw.tipo, dbId);
      }
    });
    console.log("Palavras-chave inseridas com sucesso!");

    // 4. References
    console.log("4. Inserindo referências...");
    const refMap = new Map();
    const refsByRaw = new Map();
    PARSED.referencia.forEach(r => {
      const raw = String(r.raw_reference ?? "").trim().slice(0, 1000);
      if (!raw) return;
      const existing = refsByRaw.get(raw);
      refsByRaw.set(raw, {
        raw_reference: raw,
        titulo: existing?.titulo ?? r.titulo ?? null,
        ano: existing?.ano ?? r.ano ?? null,
        doi: existing?.doi ?? r.doi ?? null
      });
    });
    const uniqueRefs = [...refsByRaw.values()];
    if (uniqueRefs.length > 0) {
      const { data, error } = await supabase
        .from("referencia")
        .upsert(uniqueRefs, { onConflict: "raw_reference" })
        .select("id, raw_reference");
      if (error) throw error;
      data.forEach(e => {
        refMap.set(e.raw_reference.trim().slice(0, 1000), e.id);
      });
    }
    console.log("Referências inseridas com sucesso!");

    // 5. Articles
    console.log("5. Inserindo artigos...");
    const articleIdByScopusId = new Map();
    const uniqueArtigos = [];
    const artigoKeys = new Set();
    PARSED.artigo.forEach(a => {
      if (!artigoKeys.has(a.scopus_id)) {
        artigoKeys.add(a.scopus_id);
        uniqueArtigos.push(a);
      }
    });
    const { data: dbArtigos, error: errArtigos } = await supabase
      .from("artigo")
      .upsert(uniqueArtigos, { onConflict: "scopus_id" })
      .select("id, scopus_id");
    if (errArtigos) throw errArtigos;
    dbArtigos.forEach(r => {
      articleIdByScopusId.set(r.scopus_id, r.id);
    });
    console.log("Artigos inseridos com sucesso!");

    // 6. Relationships
    console.log("6. Inserindo relacionamentos...");
    
    // 6.1 artigo_autor
    const allAuthorRels = [];
    const authorKeys = new Set();
    PARSED.artigo_autor.forEach(r => {
      const aid = articleIdByScopusId.get(r.temp_scopus_id);
      if (aid && r.autor_id) {
        const key = `${aid}_${r.autor_id}`;
        if (!authorKeys.has(key)) {
          authorKeys.add(key);
          allAuthorRels.push({ artigo_id: aid, autor_id: r.autor_id });
        }
      }
    });

    // 6.2 artigo_palavra_chave
    const allKwRels = [];
    const kwTempMap = new Map();
    PARSED.palavra_chave.forEach(k => kwTempMap.set(k.temp_id, k));
    const kwKeys = new Set();
    PARSED.artigo_palavra_chave.forEach(r => {
      const aid = articleIdByScopusId.get(r.temp_scopus_id);
      const kwObj = kwTempMap.get(r.temp_kw_id);
      const kwRealId = kwObj ? kwMap.get(kwObj.palavra.toLowerCase() + "_" + kwObj.tipo) : undefined;
      if (aid && kwRealId) {
        const key = `${aid}_${kwRealId}`;
        if (!kwKeys.has(key)) {
          kwKeys.add(key);
          allKwRels.push({ artigo_id: aid, palavra_chave_id: kwRealId });
        }
      }
    });

    // 6.3 artigo_referencia
    const allRefRels = [];
    const refTempMap = new Map();
    PARSED.referencia.forEach(ref => refTempMap.set(ref.temp_id, ref));
    const refKeys = new Set();
    PARSED.artigo_referencia.forEach(r => {
      const aid = articleIdByScopusId.get(r.temp_scopus_id);
      const refObj = refTempMap.get(r.temp_ref_id);
      const refRealId = refObj ? refMap.get(String(refObj.raw_reference ?? "").trim().slice(0, 1000)) : undefined;
      if (aid && refRealId) {
        const key = `${aid}_${refRealId}`;
        if (!refKeys.has(key)) {
          refKeys.add(key);
          allRefRels.push({ artigo_id: aid, referencia_id: refRealId });
        }
      }
    });

    // 6.4 artigo_open_access
    const allOaRels = [];
    const oaTempMap = new Map();
    PARSED.open_access_tipo.forEach(oa => oaTempMap.set(oa.temp_id, oa));
    const oaKeys = new Set();
    PARSED.artigo_open_access.forEach(r => {
      const aid = articleIdByScopusId.get(r.temp_scopus_id);
      const oaObj = oaTempMap.get(r.temp_oa_id);
      const oaRealId = oaObj ? oaMap.get(String(oaObj.nome ?? "").trim().toLowerCase()) : undefined;
      if (aid && oaRealId) {
        const key = `${aid}_${oaRealId}`;
        if (!oaKeys.has(key)) {
          oaKeys.add(key);
          allOaRels.push({ artigo_id: aid, open_access_tipo_id: oaRealId });
        }
      }
    });

    console.log(`- Vinculando autores (${allAuthorRels.length} relações)...`);
    await upsertInChunks("artigo_autor", allAuthorRels, "artigo_id, autor_id");
    
    console.log(`- Vinculando palavras-chave (${allKwRels.length} relações)...`);
    await upsertInChunks("artigo_palavra_chave", allKwRels, "artigo_id, palavra_chave_id");
    
    console.log(`- Vinculando referências (${allRefRels.length} relações)...`);
    await upsertInChunks("artigo_referencia", allRefRels, "artigo_id, referencia_id");
    
    console.log(`- Vinculando open access (${allOaRels.length} relações)...`);
    await upsertInChunks("artigo_open_access", allOaRels, "artigo_id, open_access_tipo_id");

    console.log("\n=== TESTE CONCLUÍDO COM SUCESSO! DADOS INSERIDOS E VINCULADOS! ===");
  } catch (e) {
    console.error("ERRO NO TESTE DE IMPORTAÇÃO:", e);
  }
}

runTest();
