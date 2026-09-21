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

A tela inicial tem **SINGLEPLAYER**, **BODYSHOP**, **PERFIL**, **MULTIPLAYER** (em breve) e **CONFIGURAÇÕES** (com a página **CONTROLES** dentro: teclas, botões do controle e teste do controle). Configurações (também na pausa, salvas no navegador, `src/settings.js`) ficam em **abas**: **ÁUDIO** (volumes geral, música, motor, rivais, efeitos, ambiente e narrador, trilha liga/desliga), **VÍDEO** (resolução interna de 360 a nativa, CRT, névoa, rastro de movimento, desfoque de movimento, tremor de câmera, campo de visão, tela cheia — também com F11, em qualquer tela), **CORRIDA** (câmera e câmbio ao largar, km/h ou mph, vibração, fantasma, sobrevoo), **INTERFACE** (tamanho do HUD de 70% a 130%, notas de estilo, rastro de drift, nomes dos rivais, minimapa, contador de FPS) e **IDIOMA**. LB/RB do controle trocam de aba, e as teclas N, V, G e K seguem mudando as mesmas opções. O singleplayer tem dois **modos**: **CORRIDA** e **ESTACIONAMENTO** (treino, abaixo). Na corrida escolhe pista (ou ALEATÓRIA), horário/clima (ou ALEATÓRIO, sorteado entre os da pista), carro, número de voltas (1, 2, 3, 5, 10 ou treino livre), grid e dificuldade, e dá acesso à **GARAGEM** e ao **RANKING**; ao lado ficam o desenho da pista, a **vitrine do carro** (o modelo 3D escolhido girando numa luz de estúdio, com o visual da garagem, `src/carPreview.js`) e a ficha técnica; tudo navegável com mouse, setas/Enter ou D-pad/A/B. O foco dos menus é um **cursor âmbar** com cantos em colchete que desliza de um item para o outro (passa um pouco do ponto e volta) com os cantos respirando; o item que ganha o foco leva uma varredura de luz e um tremor de aberração cromática, e o painel bipa como um VFD: um bipe curto ao navegar, dois ao trocar um valor e um acorde ao confirmar (volume dos EFEITOS). A corrida começa com contagem regressiva no grid, logo depois da linha, já na volta 1. Ao cruzar a chegada da última volta o combo em andamento é somado e aparece o resultado: pontos e tempo por volta, maior combo e recorde por configuração (salvo no navegador). Atrás do resultado roda o **replay da corrida** em loop, com todos os carros, fumaça e rastro de drift, cortado por um diretor de TV entre câmera de beira de pista com zoom, helicóptero, lateral baixa, órbita e frontal (`src/replay.js`; grava 30 quadros por segundo durante a corrida). `Esc` pausa (continuar, reiniciar, configurações, menu principal). Com pista ou horário aleatório o sorteio acontece a cada largada: REINICIAR repete a pista sorteada e CORRER DE NOVO sorteia outra; recorde e ranking ficam na pista que saiu. Pistas e carros ficam em `src/catalog.js`.

**Treino no estacionamento (MODO › ESTACIONAMENTO):** um pátio aberto de 150 x 104 m atrás dos armazéns do porto, de noite (torres de luz) ou de dia, cercado por mureta de concreto e alambrado, com contêineres, guindastes e a cidade ao fundo (`src/lot.js`). Não é pista: não tem volta, cronômetro, rivais, ranking nem sobrevoo, e o carro sai andando da caixa pintada. Os cones estão montados em quatro estações, com a pintura e a borracha de quem já treinou no chão: **oito** (dois montes para contornar trocando de lado), **slalom** (sete cones em linha), **grampo** (ápice e o arco de fora marcado por cones) e **pião** (um cone no meio do círculo). Os cones são soltos (`src/cones.js`): encostar faz balançar, bater derruba e joga longe (tombam, quicam, rolam e param deitados; batem na mureta), com uma pancada de plástico no lugar. O painel mostra os pontos do treino e quantos cones caíram, e passar rente a um cone de pé vale o mesmo bônus de passar rente à mureta. **R** volta para a saída, levanta os cones e devolve o carro como estava ao entrar; sair pela pausa também. O treino não gasta a lataria salva nem conta para o perfil. O pátio, a saída e os cones ficam em `src/lotLayout.js`.

**Tremor e desfoque de movimento:** a câmera treme nas batidas (na mureta, em outro carro ou num cone forte), com intensidade que cresce com a força do impacto e anda por ruído suave em vez de chacoalhar ao acaso; em alta velocidade e na calçada entra um zumbido fino, e no cockpit o tremor é menor. O desfoque de movimento borra as bordas da imagem a partir do centro conforme a velocidade (mais nas câmeras de dentro) e na direção em que a imagem anda quando a câmera gira (drift, curvas, tremor), com uma pancada extra na batida; a exposição é de 1/60 s, então o borrão é o mesmo em 30, 60 ou 144 quadros por segundo. Os dois têm nível nas CONFIGURAÇÕES › VÍDEO (desligado, suave, normal, forte).

**Rivais de IA (GRID: 1 a 8 corredores):** até 7 pilotos de IA largam à frente do jogador e disputam os mesmos pontos de drift. A classificação ao vivo (por pontos) fica à esquerda, com a posição no painel de voltas; o resultado mostra a colocação final (quem ainda não terminou entra com o que tinha quando você cruzou a chegada). Os carros colidem entre si: batida acima de 2 m/s zera o combo, encostar não. A IA (`src/ai.js`) pilota com o controle de ângulo do nível Fácil: esterça para a direção da velocidade seguir a pista, planeja a frenagem pela curvatura, faz as curvas de lado, desvia e segura distância de quem está à frente e dá ré se encalhar. No nível Fácil os rivais correm com habilidade reduzida. Para testar a IA sem navegador: `node tools/ai-lab.js 7 3` (rivais, voltas); os parâmetros também estão no painel de debug (B).

## Pistas

| Pista | Cenário | Traçado |
|---|---|---|
| CIRCUITO DO PORTO (湾岸ループ) | Zona portuária à noite: asfalto molhado, prédios, neon, muretas de concreto | ~860 m, quarteirões com esquinas de 90° |
| SERRA DE HAKONE (箱根峠) | Estrada de montanha: muros de arrimo de pedra do lado do morro e mureta do lado do vale, mata de cedros e bordos, capim e matacões no barranco, espelhos de curva laranja, placas numeradas dos grampos, casa de chá na largada, lago e mar de nuvens no vale | ~1,5 km com subida e descida de verdade: largada no alto, sete grampos descendo a encosta em zigue-zague (até 5% de descida), reta do vale e subida sinuosa de volta (até 11%) |
| ESTRADA DE FUJIMI (富士見街道) | Interior do Japão no fim de tarde: Monte Fuji ao fundo, arrozais alagados, vila com telhados de cerâmica, loja de conveniência, santuário com torii, morros com cedros, ferrovia com trem local, guard-rails com capim e moitas no pé | ~1,3 km: reta longa entre arrozais, curvas pela vila, grampo no morro, "S" na descida e reta ao lado da ferrovia |

**Cidade do porto:** prédios com fachadas geradas pixel a pixel com cor, relevo, brilho e luz própria (`src/cityTextures.js`): apartamentos de azulejo com portas de correr e varandas em 3D (laje, guarda-corpo de vidro fosco, divisória e condensador), escritórios com faixas de janela, prédios velhos de concreto com furos de forma e escorridos, azulejo marrom e galpões de metal ondulado com número pintado; janelas com caixilho, peitoril, cortina, persiana, móveis e luz interna em degradê. O térreo das fachadas de rua é modelado (`src/cityProps.js`): vitrines recuadas com caixilhos e vidro que reflete, konbini, izakaya com noren, farmácia, fliperama, oficina, portaria, portas de aço com caixa e pichação, letreiros iluminados salientes e toldos listrados, entre pilares de pedra. Nos telhados, rufos, manta com poças, caixas-d'água com estrutura e escada, casas de máquinas, antenas e condensadores com grelha; nas fachadas, canos de descida. Na rua: postes de iluminação com braço curvo, postes de fiação de concreto com faixa zebrada, cruzetas, isoladores, transformadores e fios de serviço até os prédios, semáforos japoneses de três luzes com pala (amarelo piscando) e de pedestre, árvores com folhagem em cartões, mureta de concreto envelhecida, tampas de bueiro e grelhas. A leste fica o porto (`src/port.js`): pátio de contêineres coloridos empilhados com logos, torres de iluminação, portêineres com lança em treliça e luz de aviação, cais com cabeços e defensas e a baía com água que reflete o ambiente.

**Horário e clima** (seletor HORÁRIO): no porto, *noite* ou *noite chuvosa* (chuva desenhada na GPU com riscos de borda suave, respingos no chão e cortinas de chuva ao longe que apagam o horizonte de prédios; asfalto espelhado, névoa mais fechada, chiado de chuva, spray das rodas e 80% da aderência para todos, IA incluída, que entra nas curvas com mais cautela); em Fujimi, *fim de tarde*, *noite* (lua ao lado do Fuji, estrelas, postes pela estrada e lanternas de festival na vila) ou *manhã com neblina* (névoa densa no vale e o Fuji saindo de dentro dela); em Hakone, *neblina* (céu fechado e névoa morando no vale: lá embaixo quase não se enxerga), *outono* (bordos vermelhos e amarelos, sol baixo, lago aparecendo) ou *noite* (postes de sódio nos grampos e névoa azulada). Os temas ficam em `FUJIMI_THEMES` e `HAKONE_THEMES`.

**Vegetação e chão das estradas (`src/trees.js`):** cedros montados por camadas de galhos com base recortada (silhueta espinhada, não um cone liso), folhosas com tronco, galhos e copa em aglomerado de bolas amassadas, moitas rasteiras, tufos de capim em cartões cruzados no pé do guard-rail e matacões saindo do barranco de Hakone. Cada tipo tem três variantes geradas com semente fixa e vai instanciado, então a mata inteira continua custando poucos draw calls; a cor da copa muda com o horário (verde no verão, vermelho e amarelo no outono de Hakone). O chão perto da estrada usa textura própria com relevo: capim com touceiras, terra pelada, pedrinhas e folha seca no barranco da serra, e cascalho virando mato no acostamento de Fujimi (`groundTextures` e `vergeTextures` em `src/textures.js`).

**Altura da pista:** os pontos de controle de Hakone têm altura; a pista guarda `y` e a rampa por amostra (`track.y`, `track.grade`). A gravidade entra na física pela componente ao longo da pista (descendo o carro embala, subindo perde velocidade), a IA freia antes contando com a descida, e carros, fantasma, replay, câmeras, fumaça, faíscas, marcas e rastro acompanham o chão (`followGround` e `groundAt` em `src/track.js`). A névoa rasteira tem base configurável por mundo (`uMistBase`), e na serra ela fica no vale. O relevo é um plano ajustado às alturas da estrada (mais íngreme que ela), e junto da pista a seção é modelada: muro, sarjeta e barranco até o relevo, sem atravessar os outros trechos (`src/worldHakone.js`).

Os cenários das três pistas são montados uma vez, durante a tela de carregamento inicial (cerca de 1,3 s a mais, já desenhando cada horário para subir texturas e compilar shaders), e ficam em memória: trocar de pista só esconde um e mostra o outro, e trocar de horário ou clima só muda luz, céu, neblina e efeitos (`setTime` em cada mundo). As duas trocas são praticamente instantâneas. O Fuji e as cordilheiras acompanham a câmera como um cenário distante; o relevo, as árvores e os arrozais são gerados com semente fixa (`src/worldFujimi.js`). Para testar a IA nas outras pistas: `TRACK=fujimi node tools/ai-lab.js 7 3` ou `TRACK=hakone` (com `DEBUG=1` mostra onde cada batida aconteceu).

## Apresentação

- **Tela de título:** o logo entra letra por letra e, ao fundo, o carro escolhido faz drift sozinho pela pista (a IA pilota), filmado pelas câmeras de TV do replay.
- **Sobrevoo antes da largada:** helicóptero sobre um trecho da pista, câmera baixa na curva mais fechada e descida sobre o grid, com o nome da pista em tela; Enter/A pula. Não roda ao reiniciar pela pausa; desliga em SOBREVOO (`IntroDirector` em `src/replay.js`).
- **Narrador em japonês** com a voz do próprio sistema (Web Speech API, `src/announcer.js`): contagem, ナイスドリフト, SS級, マックスコンボ, ファイナルラップ, ゴール, 優勝, メダル獲得 e boas-vindas no sobrevoo. Frases com prioridade (uma importante corta a outra). Volume em NARRADOR; sem voz japonesa instalada ele fica mudo e as configurações avisam como instalar.
- **Música que cresce com o combo:** no x3 entram um segundo arpejo, chimbal em semicolcheias e virada de caixa; no x5, lead dobrado uma oitava acima, metais agudos e prato; perder o combo derruba as camadas e fecha o filtro por um instante (`setCombo` em `src/music-dsp.js`; para ouvir: `COMBO="6:1,12:2,18:0!" node tools/render-music.js combo.wav 3 30 36`).
- **Idioma:** português ou inglês em CONFIGURAÇÕES › IDIOMA · LANGUAGE (padrão pelo idioma do navegador). O código mantém os textos em português e `t()` (`src/i18n.js`) busca a tradução em `src/lang-en.js`, com o texto original como chave; o HTML fixo é traduzido percorrendo os nós. Placas do mapa e narrador ficam em japonês nos dois idiomas.

## Carros

Quatro carros no menu, cada um com modelo 3D e acerto próprios (`src/catalog.js`; o que não é sobrescrito vem de `CAR`):

| Carro | Inspiração | Modelo | Acerto |
|---|---|---|---|
| KAZE 180 TURBO | 180SX kouki | fastback com vigia até o aerofólio da tampa, faróis escamoteáveis levantados com dois refletores, para-choque de boca larga com aletas e lanternas de canto, lanterna traseira de ponta a ponta com friso central, antena, limpador traseiro, aro de 6 raios côncavo | 1250 kg, entre-eixos 2,70 m, o acerto base |
| SEIRAN S15 SPEC-R | Silvia S15 | três volumes com cintura subindo para trás e vinco lateral, faróis repuxados com dois projetores, boca trapezoidal com colmeia, milhas redondas, lábio de carbono, lanternas que dobram a quina, aerofólio de três apoios, pintura perolizada, aro de 5 raios | 1240 kg, +10% de torque, corte a 8.000 rpm, entre-eixos 2,53 m |
| KAMINARI 86 | Sprinter Trueno AE86 | hatch de três portas baixo e quadrado, faróis escamoteáveis, capô plano, pintura de dois tons (branco em cima, preto embaixo), vinco lateral reto de ponta a ponta, calha de chuva aparente, lanternas horizontais de três células, lábio de borracha na tampa, aro de 8 raios | 950 kg, entre-eixos 2,40 m, ~50% do torque, corte a 7.800 rpm, CG baixo |
| TSUBAME NA ROADSTER | MX-5 NA | roadster redondo de cockpit aberto (recorte na lataria), para-brisa com moldura preta, santantônio, capota recolhida sob a capa, faróis escamoteáveis, boca oval, lanternas retangulares de quatro células, lábio no porta-malas, aro de malha com aba polida | 1010 kg, ~60% do torque, entre-eixos 2,27 m, CG mais baixo |

**Modelos dos carros:** releituras procedurais dos carros reais, sem arquivos 3D. A lataria (`src/carBody.js`) é desenhada por linhas como numa planta: em cada ponto do comprimento a seção passa por centro de baixo, soleira, saia, ombro (vinco), cintura, calha do teto e borda da coluna, com vincos ajustáveis e para-choques em domo; a mesma superfície vira pintura, para-brisa, vigia e janelas (com borracha de vedação e vidro 1 cm para dentro), colunas pretas e recortes das caixas de roda ou do cockpit. Os vãos de portas, capô e tampas são desenhados na própria pintura pelo shader (`src/carMaterials.js`), junto com os amassados e riscos. Materiais: pintura com verniz (sólida, metálica ou perolizada; as cores metálicas e pérola da garagem usam o acabamento certo), vidro que reflete mais de lado, cromados e plásticos, todos com o reflexo do cenário. Peças (`src/carParts.js`): faróis escamoteáveis levantados feitos com o próprio pedaço do capô girado na dobradiça (tampa na cor do carro, laterais pretas em cunha, frente com a lâmpada e o vão escuro do capô na frente), retrovisores aerodinâmicos, maçanetas, limpadores, placas com moldura e parafusos, escapamento com abafador, cintas de reboque, grades, emblemas, refletores e projetores de farol e texturas de lanterna com favo e anel; uma sonda (`src/carProbe.js`) cola lanternas, bocas e frisos exatamente sobre a lataria. Rodas (`src/carWheels.js`): pneu com ombro, banda de rodagem e letreiro ZETA na lateral, aro com raios côncavos extrudados, cubo, aba e porcas, disco com furos e pinça. Interior com painel, instrumentos acesos, console com rádio, bancos concha com cintos, gaiola e piloto. Os detalhes miúdos, o interior, os freios e as peças pequenas (retrovisores e placas) somem nos rivais distantes; a lataria de cada carro é gerada uma vez e compartilhada, e os plásticos e borrachas escuros de cada carro viram um material só com cor por vértice (menos chamadas de desenho por carro). Para ver os carros de perto: `http://localhost:4400/tools/estudio.html` (ângulos prontos, fundo neutro com `?fundo=estudio`, pista e horário por `?track=fujimi&time=tarde`, P liga o pós-processamento de PS2).

Cada carro tem o próprio som de motor: KAZE 180 com 4 cilindros turbo, SEIRAN com swap de 6 em linha turbo, KAMINARI 86 com 4 cilindros aspirado de corte alto e TSUBAME com swap de rotativo de 2 rotores. Os rivais usam os quatro carros (e os quatro motores).

**Garagem:** pintura (12 cores + 6 liberadas por medalha), rodas (6 raios, 5 raios, malha, 8 raios finos, disco; raios duplos por medalha) e cor das rodas, aerofólio (original, sem, GT alto, ducktail), rebaixamento até 6 cm, adesivo de porta em japonês (峠最速, 湾岸ドリフト, 走り屋, 風, ドリフト魂, patrocínio ゼータタイヤ) e cor do rastro de drift (multiplicador, cor fixa ou arco-íris; fogo, aurora, gelo, sakura e verde neon por medalha). Itens bloqueados aparecem com cadeado e o nome da medalha que libera. Salvo por carro (`src/garage.js`); o carro gira ao lado das opções.

**BODYSHOP (ボディショップ):** a loja do menu principal, paga com os ¥ das corridas (`src/shop.js`). Três abas:

- **CARROS:** o KAZE 180 é o carro de largada; TSUBAME (¥ 12.000), KAMINARI 86 (¥ 15.000) e SEIRAN (¥ 22.000) se compram. Quem já corria com um carro antes da loja existir fica com ele. O singleplayer só oferece os carros da sua garagem, e Enter num carro que já é seu coloca ele na pista.
- **PREPARAÇÃO:** seis kits por carro, cada um em três estágios, que mudam o acerto de verdade: motor (torque), redução de peso (massa e inércia), pneus (aderência), suspensão (centro de gravidade mais baixo e direção mais rápida), freios e kit de ângulo (mais esterço para drifts mais abertos). A ficha mostra o antes e depois, e a ficha técnica do singleplayer já sai com a preparação.
- **PEÇAS:** os itens da garagem que antes só saíam por medalha agora também se compram, mais exclusivos da loja (pinturas BRANCO CHAMPION, VERMELHO CANDY e MIDNIGHT PURPLE; adesivos 流星 e 環状族). Peça comprada vale para todos os carros.

A vitrine 3D mostra o carro em foco (na aba de peças, já com a peça aplicada). LB/RB do controle trocam de aba.

**Perfil do piloto e medalhas:** a tela PERFIL mostra km rodados, tempo ao volante, corridas, vitórias e pódios, voltas, pontos na carreira, maior combo, melhor volta e corrida, maior ângulo sustentado, drift mais longo (metros de um combo só), batidas, pista e carro favoritos e todas as notas de curva. São 22 medalhas: bronze, prata e ouro em quilometragem, combo, ângulo, drift longo, notas SS e vitórias (4+ corredores), mais Sem encostar, Rei da chuva, Rei de Hakone e Todos os climas. Cada uma libera um item da garagem; ganhar uma avisa na hora e aparece no resultado. As medalhas somam pontos para o título do piloto (Novato até Lenda). Salvo no navegador (`src/profile.js`, `src/achievements.js`).

**Faíscas e marcas:** batidas soltam um leque de faíscas e raspar a mureta andando solta um jato contínuo que fica para trás do carro, com riscos brancos que esfriam para laranja e vermelho, quicam no asfalto e acendem uma luz laranja piscando no ponto do raspão. As marcas de pneu ficam na pista a corrida inteira (buffer de 16 mil trechos, só a parte nova sobe para a GPU), mais escuras e largas quanto mais o pneu escorrega, com desenho da banda de rodagem e bordas suaves; na chuva ficam mais fracas.

**Batidas, danos e reparo:** cada batida amassa a lataria **no ponto onde encostou**, afundando a chapa na direção do impacto com a borda enrugada e a pintura estalada e fosca (até 6 amassados ao mesmo tempo; bater de novo no mesmo lugar aprofunda o que já existe), e raspar a mureta risca a pintura do lado que encostou (`src/carMaterials.js`). Vale para todos os carros, rivais incluídos (as batidas deles também entram no replay, e cada rival larga inteiro na corrida seguinte). Batida forte **arranca peças**: retrovisores, faróis escamoteáveis, placas e o aerofólio saem inteiros, e para-choques, **capô** e **portas** se soltam como painéis da própria lataria. O que sai some do carro de verdade: sem o capô aparece o **cofre do motor** (bloco, tampa de válvulas na cor de cada carro, filtro de ar, radiador, bateria), sem a porta o forro sai junto e abre para o **interior**, e sem o para-choque sobra a estrutura escura. As lanternas estouram e apagam numa batida de traseira. Cada pedaço vira destroço com física própria (`src/debris.js`: queda, quique, atrito e giro) e fica no asfalto, junto com lascas de pintura e cacos de vidro, com som de vidro quebrando. Batida forte também quica menos (a energia vai para o amassado, `src/walls.js`). A lataria de cada carro **fica como ficou** entre as corridas (amassados e peças faltando são salvos no perfil). Cada corrida paga um prêmio em **¥** (pontos valem dinheiro e o pódio dá bônus) e o conserto sai do bolso na **GARAGEM**: amassado custa mais que risco e cada peça arrancada tem preço. Consertar remonta o carro inteiro; sem saldo, o botão pisca e o carro continua marcado.

A corrida larga na reta logo depois da linha e já começa na volta 1 (a reta antes da linha é curta demais para um grid de 8).

## Controles extras

- **Ré:** parado, segure o freio (S / LT) em qualquer câmbio; ela vai até ~40 km/h. Acelerar de ré freia e engata a 1ª.
- **Câmeras (tecla C):** perseguição, perseguição distante, capô e **cockpit** (nos olhos do piloto, com a rolagem e a arfagem da carroceria; em drift a vista acompanha um pouco a direção do carro, e a órbita vira "olhar em volta"). A escolhida ao largar fica em CONFIGURAÇÕES › CÂMERA.
- **Câmera 360°:** analógico direito (ou arrastar o mouse) gira em volta do carro e sobe/desce; volta para trás do carro 1,5 s depois de soltar.

## Painel de debug (tecla B)

Abre por cima do jogo sem pausar (arraste pelo título). Mostra ao vivo velocidade, ângulo de drift, guinada, esterço, deriva, carga, forças e uso de aderência de cada eixo, giro/torque, arrasto, torque das assistências, entradas e FPS, com círculo de atrito e gráfico dos últimos 6 s.

Embaixo, todos os parâmetros de `CAR` (gravidade, massa, pneus, motor, freios, direção, assistências, modo Fácil), aderência dos pisos, paredes e pontuação, com velocidade do tempo (câmera lenta). Valores alterados ficam em âmbar e salvos no navegador; **exportar / importar** mostra o acerto em JSON para copiar para `src/physics.js` ou colar de volta.

**Câmera livre** (botão no painel ou tecla `F`): congela a corrida, esconde HUD e menus e deixa voar pelo mapa. WASD/setas movem, arrastar o mouse gira, Espaço/E sobe, C/Q desce, Shift acelera, Ctrl vai devagar, a roda do mouse muda a velocidade; no controle, analógicos e RT/LT. `F` ou `Esc` volta para onde estava (`src/freeCam.js`). O Fuji e as cordilheiras são cenário de fundo pensado para a vista da estrada: vistos do alto, aparecem como silhuetas.

## Som do motor

Sintetizado em `src/engine-dsp.js` (pulsos de combustão, ressonância do escapamento, admissão, turbo, válvula de alívio e estalos) e tocado num AudioWorklet (`src/engine-worklet.js`). Perfis em `ENGINE_PROFILES`: **4 cilindros aspirado** (sem turbo, admissão mais presente e corte alto, o motor do KAMINARI), **4 cilindros turbo** (4 pulsos por ciclo, cilindros levemente desiguais), **6 em linha turbo** (6 pulsos, mais liso e grave, turbo mais cheio) e **rotativo** (janela de escape longa que dá o zumbido áspero, marcha lenta irregular "brap brap", sem turbo e com mais estalos). Para ouvir fora do jogo: `node tools/render-engine.js motor.wav [i4t|i4na|i6t|rotary]`.

## Som ambiente

Cada pista tem o seu fundo, sintetizado na hora como o motor e a trilha (`src/ambience.js`), num barramento com volume próprio (CONFIGURAÇÕES › ÁUDIO › AMBIENTE):

- **Estrada de Fujimi:** coro de cigarras no fim de tarde (ruído agudo picotado por tremolo, indo e voltando devagar), corvo ao longe de vez em quando, vento fraco nas árvores e o **sino da passagem de nível** batendo enquanto o trem local passa pela reta.
- **Serra de Hakone:** vento na mata com rajadas, água escorrendo na valeta com gotas soltas, corvo no vale e o **eco do escapamento nos muros de pedra** — parte do som do motor volta atrasada, sempre presente na serra e mais forte quando o carro encosta no muro dos grampos.
- **Circuito do porto:** zumbido grave do pátio, batidas metálicas dos contêineres e buzina de navio de vez em quando (mais a chuva, quando é o caso).

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
| `src/walls.js` | Colisão com as paredes (da pista e do recinto retangular do estacionamento): impulso de corpo rígido com restituição e atrito. |
| `src/lot.js`, `src/lotLayout.js`, `src/cones.js` | Estacionamento de treino: cenário (asfalto, pintura, borracha, muretas, alambrado, torres de luz, armazéns, contêineres), medidas, saída e estações, e os cones soltos. |
| `src/drift.js` | Regras de pontuação (combo, multiplicador, bônus, perdas). |
| `src/track.js` | Traçados (spline Catmull-Rom fechada), altura e rampa por amostra, superfícies (asfalto/calçada) e posição das muretas. |
| `src/laps.js`, `src/ranking.js` | Voltas e trajetória de cada volta; ranking das 10 melhores por pista e carro com fantasma (localStorage). |
| `src/styleJudge.js` | Detecção das curvas pela curvatura e nota de estilo (ângulo, linha, fumaça). |
| `src/shop.js` | BODYSHOP: preços dos carros, os kits de preparação (e como mexem no acerto) e as peças à venda. |
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
| `src/textures.js` | Texturas procedurais pixel a pixel (asfalto com poças, rachaduras, bueiro e faixas gastas; blocos de calçada; guia; marcas de pneu; pintura 止まれ; piso tátil) com normal map e mapa especular. Também o chão de mato (capim, terra, pedrinhas e folha seca) e o acostamento (cascalho virando mato junto ao guard-rail). |
| `src/fog.js` | Névoa rasteira 3D (densidade por altura integrada no raio + ruído que se move) injetada nos shaders de neblina do three.js, e cones de luz aditivos dos postes e faróis. Tecla N liga/desliga. |
| `src/ps2.js` | Pós-processamento: cena em 540 linhas, bloom, rastro, desfoque de movimento (radial e de giro) e pontilhado; passada final em resolução da tela com efeito CRT (scanlines leves, grade de fósforo, curvatura, aberração cromática; tecla V). |
| `src/ai.js`, `src/rivals.js`, `src/traffic.js`, `src/race.js` | Piloto de IA de drift, rivais no jogo (modelo, nome, pontos, voltas), colisão entre carros e grid de largada. |
| `src/i18n.js`, `src/lang-en.js` | Idioma da interface (português/inglês) e dicionário inglês. |
| `src/announcer.js` | Narrador em japonês pela voz do sistema. |
| `src/trees.js` | Vegetação dos mapas de estrada: cedros em camadas, folhosas, moitas, tufos de capim em cartões e matacões, tudo instanciado em variantes com semente fixa. |
| `src/carPreview.js` | Vitrine do carro no menu: renderizador próprio do cartão de seleção, com luz de estúdio e o carro girando. |
| `src/menu.js`, `src/catalog.js` | Menus (inicial, singleplayer, garagem, ranking, perfil, configurações, controles, pausa, resultado) e lista de pistas/carros/voltas. |
| `src/debug.js` | Painel de debug (B): telemetria, gráficos e ajuste fino dos parâmetros com persistência e exportação em JSON. |
| `src/hud.js`, `src/segments.js` | HUD estilo painel eletrônico anos 80-90 (VFD): dígitos de 7 segmentos em SVG, conta-giros em barras e luzes de aviso, com tamanho ajustável nas configurações. |
| `src/debris.js` | Destroços das batidas: peças e painéis arrancados, lascas de pintura e cacos de vidro com física simples (queda, quique, atrito, giro). |
| `src/particles.js`, `src/skids.js` | Fumaça, faíscas (leque de batida e jato de raspão) e marcas de pneu persistentes. |
| `src/ambience.js` | Som ambiente de cada pista: cigarras, corvo, vento, água, sino da passagem de nível, guindaste e buzina de navio, mais o eco do escapamento na serra. |
| `src/audio.js`, `src/bot.js` | Som (efeitos e música em barramentos separados) e piloto automático dos testes. |
| `src/music-dsp.js`, `src/music-worklet.js` | Eurobeat procedural: composição (progressões, melodia por motivo, estrutura) e síntese (bateria, baixo, supersaw, arpejo, lead, delay, reverb). |

A física roda em passo fixo de 240 Hz, separada da taxa de quadros.
No console do navegador, `game.CAR` permite ajustar o acerto ao vivo (ex.: `game.CAR.counterSteer = 0.7`).
