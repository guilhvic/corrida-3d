# Corrida 3D · Drift Noturno

Jogo de drift de rua no navegador: circuito de quarteirões (~860 m) numa cidade japonesa à noite (todos os textos do cenário em japonês), visual de PS2 tardio
(cena em 540 linhas esticada, bloom, rastro de movimento, luz pintada no chão) e coupé japonês dos anos 90.
three.js para renderização, física de veículo e colisão próprias.

```bash
npm start      # http://localhost:4400
npm test       # testes headless: drift, paredes, pontuação, voltas, pilotagem de teclado, IA
```

Sem build e sem dependências npm: o three.js vem do CDN via import map (`index.html`).

## Corrida

A tela inicial tem **SINGLEPLAYER**, **PERFIL**, **MULTIPLAYER** (em breve) e **CONFIGURAÇÕES** (com a página **CONTROLES** dentro: teclas, botões do controle e teste do controle). Configurações (também na pausa, salvas no navegador, `src/settings.js`): volumes geral, música, motor, rivais e efeitos, trilha liga/desliga; resolução interna (360 a nativa), CRT, névoa, rastro de movimento, campo de visão, contador de FPS; câmera e câmbio ao largar, km/h ou mph, vibração do controle, fantasma, notas de estilo, rastro de drift, nomes dos rivais e minimapa. As teclas N, V, G e K mudam as mesmas opções. O singleplayer escolhe pista (ou ALEATÓRIA), horário/clima (ou ALEATÓRIO, sorteado entre os da pista), carro, número de voltas (1, 2, 3, 5, 10 ou treino livre), grid e dificuldade, e dá acesso à **GARAGEM** e ao **RANKING**; tudo navegável com mouse, setas/Enter ou D-pad/A/B. A corrida começa com contagem regressiva no grid, logo depois da linha, já na volta 1. Ao cruzar a chegada da última volta o combo em andamento é somado e aparece o resultado: pontos e tempo por volta, maior combo e recorde por configuração (salvo no navegador). Atrás do resultado roda o **replay da corrida** em loop, com todos os carros, fumaça e rastro de drift, cortado por um diretor de TV entre câmera de beira de pista com zoom, helicóptero, lateral baixa, órbita e frontal (`src/replay.js`; grava 30 quadros por segundo durante a corrida). `Esc` pausa (continuar, reiniciar, configurações, menu principal). Com pista ou horário aleatório o sorteio acontece a cada largada: REINICIAR repete a pista sorteada e CORRER DE NOVO sorteia outra; recorde e ranking ficam na pista que saiu. Pistas e carros ficam em `src/catalog.js`.

**Rivais de IA (GRID: 1 a 8 corredores):** até 7 pilotos de IA largam à frente do jogador e disputam os mesmos pontos de drift. A classificação ao vivo (por pontos) fica à esquerda, com a posição no painel de voltas; o resultado mostra a colocação final (quem ainda não terminou entra com o que tinha quando você cruzou a chegada). Os carros colidem entre si: batida acima de 2 m/s zera o combo, encostar não. A IA (`src/ai.js`) pilota com o controle de ângulo do nível Fácil: esterça para a direção da velocidade seguir a pista, planeja a frenagem pela curvatura, faz as curvas de lado, desvia e segura distância de quem está à frente e dá ré se encalhar. No nível Fácil os rivais correm com habilidade reduzida. Para testar a IA sem navegador: `node tools/ai-lab.js 7 3` (rivais, voltas); os parâmetros também estão no painel de debug (B).

## Pistas

| Pista | Cenário | Traçado |
|---|---|---|
| CIRCUITO DO PORTO (湾岸ループ) | Zona portuária à noite: asfalto molhado, prédios, neon, muretas de concreto | ~860 m, quarteirões com esquinas de 90° |
| SERRA DE HAKONE (箱根峠) | Estrada de montanha: muros de arrimo de pedra do lado do morro e mureta do lado do vale, mata de cedros e bordos, espelhos de curva laranja, placas numeradas dos grampos, casa de chá na largada, lago e mar de nuvens no vale | ~1,5 km com subida e descida de verdade: largada no alto, sete grampos descendo a encosta em zigue-zague (até 5% de descida), reta do vale e subida sinuosa de volta (até 11%) |
| ESTRADA DE FUJIMI (富士見街道) | Interior do Japão no fim de tarde: Monte Fuji ao fundo, arrozais alagados, vila com telhados de cerâmica, loja de conveniência, santuário com torii, morros com cedros, ferrovia com trem local, guard-rails | ~1,3 km: reta longa entre arrozais, curvas pela vila, grampo no morro, "S" na descida e reta ao lado da ferrovia |

**Cidade do porto:** prédios com fachadas geradas pixel a pixel com cor, relevo, brilho e luz própria (`src/cityTextures.js`): apartamentos de azulejo com portas de correr e varandas em 3D (laje, guarda-corpo de vidro fosco, divisória e condensador), escritórios com faixas de janela, prédios velhos de concreto com furos de forma e escorridos, azulejo marrom e galpões de metal ondulado com número pintado; janelas com caixilho, peitoril, cortina, persiana, móveis e luz interna em degradê. O térreo das fachadas de rua é modelado (`src/cityProps.js`): vitrines recuadas com caixilhos e vidro que reflete, konbini, izakaya com noren, farmácia, fliperama, oficina, portaria, portas de aço com caixa e pichação, letreiros iluminados salientes e toldos listrados, entre pilares de pedra. Nos telhados, rufos, manta com poças, caixas-d'água com estrutura e escada, casas de máquinas, antenas e condensadores com grelha; nas fachadas, canos de descida. Na rua: postes de iluminação com braço curvo, postes de fiação de concreto com faixa zebrada, cruzetas, isoladores, transformadores e fios de serviço até os prédios, semáforos japoneses de três luzes com pala (amarelo piscando) e de pedestre, árvores com folhagem em cartões, mureta de concreto envelhecida, tampas de bueiro e grelhas. A leste fica o porto (`src/port.js`): pátio de contêineres coloridos empilhados com logos, torres de iluminação, portêineres com lança em treliça e luz de aviação, cais com cabeços e defensas e a baía com água que reflete o ambiente.

**Horário e clima** (seletor HORÁRIO): no porto, *noite* ou *noite chuvosa* (chuva desenhada na GPU com riscos de borda suave, respingos no chão e cortinas de chuva ao longe que apagam o horizonte de prédios; asfalto espelhado, névoa mais fechada, chiado de chuva, spray das rodas e 80% da aderência para todos, IA incluída, que entra nas curvas com mais cautela); em Fujimi, *fim de tarde*, *noite* (lua ao lado do Fuji, estrelas, postes pela estrada e lanternas de festival na vila) ou *manhã com neblina* (névoa densa no vale e o Fuji saindo de dentro dela); em Hakone, *neblina* (céu fechado e névoa morando no vale: lá embaixo quase não se enxerga), *outono* (bordos vermelhos e amarelos, sol baixo, lago aparecendo) ou *noite* (postes de sódio nos grampos e névoa azulada). Os temas ficam em `FUJIMI_THEMES` e `HAKONE_THEMES`.

**Altura da pista:** os pontos de controle de Hakone têm altura; a pista guarda `y` e a rampa por amostra (`track.y`, `track.grade`). A gravidade entra na física pela componente ao longo da pista (descendo o carro embala, subindo perde velocidade), a IA freia antes contando com a descida, e carros, fantasma, replay, câmeras, fumaça, faíscas, marcas e rastro acompanham o chão (`followGround` e `groundAt` em `src/track.js`). A névoa rasteira tem base configurável por mundo (`uMistBase`), e na serra ela fica no vale. O relevo é um plano ajustado às alturas da estrada (mais íngreme que ela), e junto da pista a seção é modelada: muro, sarjeta e barranco até o relevo, sem atravessar os outros trechos (`src/worldHakone.js`).

Os cenários das três pistas são montados uma vez, durante a tela de carregamento inicial (cerca de 1,3 s a mais, já desenhando cada horário para subir texturas e compilar shaders), e ficam em memória: trocar de pista só esconde um e mostra o outro, e trocar de horário ou clima só muda luz, céu, neblina e efeitos (`setTime` em cada mundo). As duas trocas são praticamente instantâneas. O Fuji e as cordilheiras acompanham a câmera como um cenário distante; o relevo, as árvores e os arrozais são gerados com semente fixa (`src/worldFujimi.js`). Para testar a IA nas outras pistas: `TRACK=fujimi node tools/ai-lab.js 7 3` ou `TRACK=hakone` (com `DEBUG=1` mostra onde cada batida aconteceu).

## Apresentação

- **Tela de título:** o logo entra letra por letra e, ao fundo, o carro escolhido faz drift sozinho pela pista (a IA pilota), filmado pelas câmeras de TV do replay.
- **Sobrevoo antes da largada:** helicóptero sobre um trecho da pista, câmera baixa na curva mais fechada e descida sobre o grid, com o nome da pista em tela; Enter/A pula. Não roda ao reiniciar pela pausa; desliga em SOBREVOO (`IntroDirector` em `src/replay.js`).
- **Narrador em japonês** com a voz do próprio sistema (Web Speech API, `src/announcer.js`): contagem, ナイスドリフト, SS級, マックスコンボ, ファイナルラップ, ゴール, 優勝, メダル獲得 e boas-vindas no sobrevoo. Frases com prioridade (uma importante corta a outra). Volume em NARRADOR; sem voz japonesa instalada ele fica mudo e as configurações avisam como instalar.
- **Música que cresce com o combo:** no x3 entram um segundo arpejo, chimbal em semicolcheias e virada de caixa; no x5, lead dobrado uma oitava acima, metais agudos e prato; perder o combo derruba as camadas e fecha o filtro por um instante (`setCombo` em `src/music-dsp.js`; para ouvir: `COMBO="6:1,12:2,18:0!" node tools/render-music.js combo.wav 3 30 36`).
- **Idioma:** português ou inglês em CONFIGURAÇÕES › IDIOMA · LANGUAGE (padrão pelo idioma do navegador). O código mantém os textos em português e `t()` (`src/i18n.js`) busca a tradução em `src/lang-en.js`, com o texto original como chave; o HTML fixo é traduzido percorrendo os nós. Placas do mapa e narrador ficam em japonês nos dois idiomas.

## Carros

Três carros no menu, cada um com modelo 3D e acerto próprios (`src/catalog.js`; o que não é sobrescrito vem de `CAR`):

| Carro | Inspiração | Modelo | Acerto |
|---|---|---|---|
| KAZE 180 TURBO | 180SX kouki | fastback com vigia até o aerofólio da tampa, faróis escamoteáveis levantados com dois refletores, para-choque de boca larga com aletas e lanternas de canto, lanterna traseira de ponta a ponta com friso central, antena, limpador traseiro, aro de 6 raios côncavo | 1250 kg, entre-eixos 2,70 m, o acerto base |
| SEIRAN S15 SPEC-R | Silvia S15 | três volumes com cintura subindo para trás e vinco lateral, faróis repuxados com dois projetores, boca trapezoidal com colmeia, milhas redondas, lábio de carbono, lanternas que dobram a quina, aerofólio de três apoios, pintura perolizada, aro de 5 raios | 1240 kg, +10% de torque, corte a 8.000 rpm, entre-eixos 2,53 m |
| TSUBAME NA ROADSTER | MX-5 NA | roadster redondo de cockpit aberto (recorte na lataria), para-brisa com moldura preta, santantônio, capota recolhida sob a capa, faróis escamoteáveis, boca oval, lanternas retangulares de quatro células, lábio no porta-malas, aro de malha com aba polida | 1010 kg, ~60% do torque, entre-eixos 2,27 m, CG mais baixo |

**Modelos dos carros:** releituras procedurais dos carros reais, sem arquivos 3D. A lataria (`src/carBody.js`) é desenhada por linhas como numa planta: em cada ponto do comprimento a seção passa por centro de baixo, soleira, saia, ombro (vinco), cintura, calha do teto e borda da coluna, com vincos ajustáveis e para-choques em domo; a mesma superfície vira pintura, para-brisa, vigia e janelas (com borracha de vedação e vidro 1 cm para dentro), colunas pretas e recortes das caixas de roda ou do cockpit. Os vãos de portas, capô e tampas são desenhados na própria pintura pelo shader (`src/carMaterials.js`), junto com os amassados e riscos. Materiais: pintura com verniz (sólida, metálica ou perolizada; as cores metálicas e pérola da garagem usam o acabamento certo), vidro que reflete mais de lado, cromados e plásticos, todos com o reflexo do cenário. Peças (`src/carParts.js`): faróis escamoteáveis levantados feitos com o próprio pedaço do capô girado na dobradiça (tampa na cor do carro, laterais pretas em cunha, frente com a lâmpada e o vão escuro do capô na frente), retrovisores aerodinâmicos, maçanetas, limpadores, placas com moldura e parafusos, escapamento com abafador, cintas de reboque, grades, emblemas, refletores e projetores de farol e texturas de lanterna com favo e anel; uma sonda (`src/carProbe.js`) cola lanternas, bocas e frisos exatamente sobre a lataria. Rodas (`src/carWheels.js`): pneu com ombro, banda de rodagem e letreiro ZETA na lateral, aro com raios côncavos extrudados, cubo, aba e porcas, disco com furos e pinça. Interior com painel, instrumentos acesos, console com rádio, bancos concha com cintos, gaiola e piloto. Os detalhes miúdos e o interior somem nos rivais distantes; a lataria de cada carro é gerada uma vez e compartilhada. Para ver os carros de perto: `http://localhost:4400/tools/estudio.html` (ângulos prontos, fundo neutro com `?fundo=estudio`, pista e horário por `?track=fujimi&time=tarde`, P liga o pós-processamento de PS2).

Cada carro tem o próprio som de motor: KAZE 180 com 4 cilindros turbo, SEIRAN com swap de 6 em linha turbo e TSUBAME com swap de rotativo de 2 rotores. Os rivais usam os três carros (e os três motores).

**Garagem:** pintura (12 cores + 6 liberadas por medalha), rodas (6 raios, 5 raios, malha, 8 raios finos, disco; raios duplos por medalha) e cor das rodas, aerofólio (original, sem, GT alto, ducktail), rebaixamento até 6 cm, adesivo de porta em japonês (峠最速, 湾岸ドリフト, 走り屋, 風, ドリフト魂, patrocínio ゼータタイヤ) e cor do rastro de drift (multiplicador, cor fixa ou arco-íris; fogo, aurora, gelo, sakura e verde neon por medalha). Itens bloqueados aparecem com cadeado e o nome da medalha que libera. Salvo por carro (`src/garage.js`); o carro gira ao lado das opções.

**Perfil do piloto e medalhas:** a tela PERFIL mostra km rodados, tempo ao volante, corridas, vitórias e pódios, voltas, pontos na carreira, maior combo, melhor volta e corrida, maior ângulo sustentado, drift mais longo (metros de um combo só), batidas, pista e carro favoritos e todas as notas de curva. São 22 medalhas: bronze, prata e ouro em quilometragem, combo, ângulo, drift longo, notas SS e vitórias (4+ corredores), mais Sem encostar, Rei da chuva, Rei de Hakone e Todos os climas. Cada uma libera um item da garagem; ganhar uma avisa na hora e aparece no resultado. As medalhas somam pontos para o título do piloto (Novato até Lenda). Salvo no navegador (`src/profile.js`, `src/achievements.js`).

**Faíscas e marcas:** batidas soltam um leque de faíscas e raspar a mureta andando solta um jato contínuo que fica para trás do carro, com riscos brancos que esfriam para laranja e vermelho, quicam no asfalto e acendem uma luz laranja piscando no ponto do raspão. As marcas de pneu ficam na pista a corrida inteira (buffer de 16 mil trechos, só a parte nova sobe para a GPU), mais escuras e largas quanto mais o pneu escorrega, com desenho da banda de rodagem e bordas suaves; na chuva ficam mais fracas.

**Danos:** batidas amassam para-choques e laterais e raspar a mureta risca a pintura do lado que encostou (deformação e riscos no shader dos materiais do carro). Zera a cada corrida. Os modelos são descritos em `src/cars/` e montados por `src/carModel.js` (ver Modelos dos carros).

A corrida larga na reta logo depois da linha e já começa na volta 1 (a reta antes da linha é curta demais para um grid de 8).

## Controles extras

- **Ré:** parado, segure o freio (S / LT) em qualquer câmbio; ela vai até ~40 km/h. Acelerar de ré freia e engata a 1ª.
- **Câmera 360°:** analógico direito (ou arrastar o mouse) gira em volta do carro e sobe/desce; volta para trás do carro 1,5 s depois de soltar.

## Painel de debug (tecla B)

Abre por cima do jogo sem pausar (arraste pelo título). Mostra ao vivo velocidade, ângulo de drift, guinada, esterço, deriva, carga, forças e uso de aderência de cada eixo, giro/torque, arrasto, torque das assistências, entradas e FPS, com círculo de atrito e gráfico dos últimos 6 s.

Embaixo, todos os parâmetros de `CAR` (gravidade, massa, pneus, motor, freios, direção, assistências, modo Fácil), aderência dos pisos, paredes e pontuação, com velocidade do tempo (câmera lenta). Valores alterados ficam em âmbar e salvos no navegador; **exportar / importar** mostra o acerto em JSON para copiar para `src/physics.js` ou colar de volta.

**Câmera livre** (botão no painel ou tecla `F`): congela a corrida, esconde HUD e menus e deixa voar pelo mapa. WASD/setas movem, arrastar o mouse gira, Espaço/E sobe, C/Q desce, Shift acelera, Ctrl vai devagar, a roda do mouse muda a velocidade; no controle, analógicos e RT/LT. `F` ou `Esc` volta para onde estava (`src/freeCam.js`). O Fuji e as cordilheiras são cenário de fundo pensado para a vista da estrada: vistos do alto, aparecem como silhuetas.

## Som do motor

Sintetizado em `src/engine-dsp.js` (pulsos de combustão, ressonância do escapamento, admissão, turbo, válvula de alívio e estalos) e tocado num AudioWorklet (`src/engine-worklet.js`). Perfis em `ENGINE_PROFILES`: **4 cilindros turbo** (4 pulsos por ciclo, cilindros levemente desiguais), **6 em linha turbo** (6 pulsos, mais liso e grave, turbo mais cheio) e **rotativo** (janela de escape longa que dá o zumbido áspero, marcha lenta irregular "brap brap", sem turbo e com mais estalos). Para ouvir fora do jogo: `node tools/render-engine.js motor.wav [i4t|i6t|rotary]`.

## Música

Trilha **eurobeat original e procedural** (`src/music-dsp.js`, tocada num AudioWorklet): 6 músicas, cada uma gerada de uma semente com tom, andamento (154 a 161 BPM), progressões, melodia do refrão, arpejo e timbre do lead próprios. Cada uma tem intro, verso, pré-refrão com virada e subida, refrão, break sem bumbo, refrão de novo e último refrão modulado um tom acima (~3 min), e depois passa para a próxima. Bumbo quatro por tempo com "pumping", prato aberto no contratempo, baixo em oitavas, acordes de supersaw, arpejo e lead com glide, delay e reverb. Na corrida toca cheia; no menu, na pausa e no resultado fica abafada (efeitos calam, música continua). `K` liga/desliga (fica salvo), `L` pula para a próxima. Para ouvir fora do jogo: `node tools/render-music.js musica.wav [0-5] [segundos] [compasso inicial]`.

## Dificuldade

Escolha no menu, com `H` ou com o botão X do controle (fica salva no navegador).

- **Fácil** (padrão): esterço todo + acelerador acima de 36 km/h entra de lado; o ângulo segue o esterço (até ~40°) e é mantido pelo jogo, com um leve empurrão para não perder embalo. Soltar o esterço endireita; sem acelerador a curva fica na aderência.
- **Normal**: contra-esterço automático e anti-rodada; o ângulo depende de dosar acelerador e esterço.
- **Simulação**: sem assistências.

Em todas, bater na mureta ou rodar zera o combo.

## Como pontua

- Drift conta a partir de 12° de ângulo e 25 km/h. Pontos por segundo crescem com ângulo (até 70°) e velocidade.
- A cada 3 s de drift contínuo o multiplicador sobe +0,5 (até x5). Trocar de lado sem perder o drift (transição) também dá +0,5.
- Bônus: ângulo alto (>45° por 1 s), drift longo (8 s), rente à parede (<1,5 m, pontos x1,5).
- Ficar 1,1 s sem driftar fecha o combo e soma no total. Bater na mureta ou rodar zera o combo.
- **Nota de estilo por curva:** no fim de cada curva o juiz dá uma nota de D a SS pelo ângulo médio, pela linha (por fora na entrada, rente à parte de dentro no ápice, abrindo na saída) e pela fumaça. SS/S/A/B rendem +1200/700/350/150 pontos (dentro do combo, se ele estiver valendo); bater na curva dá X. O resultado mostra quantas notas de cada tipo (`src/styleJudge.js`; limites no painel de debug).
- **Ranking de voltas** por pista e carro: as 10 voltas de mais pontos ficam salvas com o fantasma de cada uma. Na tela RANKING dá para escolher contra qual fantasma correr (ou nenhum); por padrão é o 1º (`src/ranking.js`).
- Enquanto o combo vale, as lanternas deixam um rastro de luz com a cor do multiplicador (verde no x1, âmbar, vermelho, rosa no x5), que esmaece na folga, dá um clarão dourado ao somar e um vermelho ao perder (`src/driftTrail.js`).

## Estrutura

| Arquivo | O que faz |
|---|---|
| `src/physics.js` | Carro: pneus (Pacejka), círculo de atrito, transferência de carga, motor, câmbio, freios. Acerto de drift e assistências (contra-esterço, anti-rodada, TC, ABS) em `CAR`. |
| `src/difficulty.js` | Níveis Fácil/Normal/Simulação (combinações de assistências). |
| `src/walls.js` | Colisão com as paredes: impulso de corpo rígido com restituição e atrito. |
| `src/drift.js` | Regras de pontuação (combo, multiplicador, bônus, perdas). |
| `src/track.js` | Traçados (spline Catmull-Rom fechada), altura e rampa por amostra, superfícies (asfalto/calçada) e posição das muretas. |
| `src/laps.js`, `src/ranking.js` | Voltas e trajetória de cada volta; ranking das 10 melhores por pista e carro com fantasma (localStorage). |
| `src/styleJudge.js` | Detecção das curvas pela curvatura e nota de estilo (ângulo, linha, fumaça). |
| `src/garage.js` | Opções visuais da garagem por carro, com itens liberados por medalha. |
| `src/profile.js`, `src/achievements.js` | Estatísticas de carreira do piloto e medalhas (metas, progresso, item liberado, título). |
| `src/rain.js` | Chuva em volta da câmera, toda na GPU: riscos expandidos em espaço de tela, respingos e cortinas de névoa ao longe. |
| `src/replay.js` | Gravação da corrida e diretor de câmeras do replay. |
| `src/driftTrail.js`, `src/freeCam.js` | Rastro de luz do drift e câmera livre do debug. |
| `src/input.js` | Teclado e controle Xbox/PlayStation (gatilhos analógicos, vibração). |
| `src/worldHakone.js` | Serra de Hakone: relevo ajustado à estrada, muros de arrimo e mureta de pedra, sarjeta e barranco por seção, cedros e bordos, grampos com setas, espelhos e placas numeradas, casa de chá, postes de sódio, lago e mar de nuvens. |
| `src/worldFujimi.js` | Estrada de Fujimi: céu de fim de tarde, Monte Fuji e cordilheiras, relevo, arrozais, vila, santuário, ferrovia e trem, guard-rails, placas. |
| `src/world.js` | Cidade: asfalto molhado, calçadas, muretas, prédios, neon, postes, fiação, semáforos. |
| `src/cityTextures.js`, `src/cityProps.js`, `src/port.js` | Texturas e modelos da cidade do porto (fachadas, térreo, varandas, telhados, mobiliário de rua) e a zona portuária (contêineres, portêineres, cais e baía). |
| `src/carModel.js`, `src/carDesigns.js`, `src/cars/` | Modelos dos carros: partes comuns (materiais, interior, rodas, luzes, garagem, danos) e os designs de cada carro (linhas da lataria, vidros, vãos e peças). Opcional: `assets/carro.glb` (ver `assets/LEIA-ME.md`). |
| `src/carBody.js`, `src/carProbe.js`, `src/carParts.js`, `src/carWheels.js`, `src/carMaterials.js` | Lataria por linhas de desenho, sonda de superfície, biblioteca de peças, rodas e freios, materiais e shader de vãos/danos. |
| `tools/estudio.html` | Estúdio para ver os carros de perto em qualquer pista, com ângulos prontos. |
| `src/neon.js` | Bairro noturno: placas verticais salientes (atlas numa malha só), tubos de neon 3D com sequência e tremulação, contornos nos telhados, lâmpadas de marquise, lanternas de papel, telões de LED e poças de luz colorida. |
| `src/textures.js` | Texturas procedurais pixel a pixel (asfalto com poças, rachaduras, bueiro e faixas gastas; blocos de calçada; guia; marcas de pneu; pintura 止まれ; piso tátil) com normal map e mapa especular. |
| `src/fog.js` | Névoa rasteira 3D (densidade por altura integrada no raio + ruído que se move) injetada nos shaders de neblina do three.js, e cones de luz aditivos dos postes e faróis. Tecla N liga/desliga. |
| `src/ps2.js` | Pós-processamento: cena em 540 linhas, bloom, rastro e pontilhado; passada final em resolução da tela com efeito CRT (scanlines leves, grade de fósforo, curvatura, aberração cromática; tecla V). |
| `src/ai.js`, `src/rivals.js`, `src/traffic.js`, `src/race.js` | Piloto de IA de drift, rivais no jogo (modelo, nome, pontos, voltas), colisão entre carros e grid de largada. |
| `src/i18n.js`, `src/lang-en.js` | Idioma da interface (português/inglês) e dicionário inglês. |
| `src/announcer.js` | Narrador em japonês pela voz do sistema. |
| `src/menu.js`, `src/catalog.js` | Menus (inicial, singleplayer, garagem, ranking, perfil, configurações, controles, pausa, resultado) e lista de pistas/carros/voltas. |
| `src/debug.js` | Painel de debug (B): telemetria, gráficos e ajuste fino dos parâmetros com persistência e exportação em JSON. |
| `src/hud.js`, `src/segments.js` | HUD estilo painel eletrônico anos 80-90 (VFD): dígitos de 7 segmentos em SVG, conta-giros em barras, luzes de aviso. |
| `src/particles.js`, `src/skids.js` | Fumaça, faíscas (leque de batida e jato de raspão) e marcas de pneu persistentes. |
| `src/audio.js`, `src/bot.js` | Som (efeitos e música em barramentos separados) e piloto automático dos testes. |
| `src/music-dsp.js`, `src/music-worklet.js` | Eurobeat procedural: composição (progressões, melodia por motivo, estrutura) e síntese (bateria, baixo, supersaw, arpejo, lead, delay, reverb). |

A física roda em passo fixo de 240 Hz, separada da taxa de quadros.
No console do navegador, `game.CAR` permite ajustar o acerto ao vivo (ex.: `game.CAR.counterSteer = 0.7`).
