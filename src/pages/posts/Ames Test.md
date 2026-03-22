---
date: 2026-03-22
layout: ../../layouts/blog.astro
title: What is an Ames Test?
---

The Ames test is a short running test used for detecting substances that cause mutagenesis.

### The science behind Ames test

In the later stages of drug development, after selecting a few “molecular candidates” but before animal trials, the candidates are subjected to a test called the Ames test, named after the biochemist Bruce Ames, who created and popularized the test.

The test is used for detecting the ability of a substance to cause mutations in our DNA. Such substances are called mutagens. It is one of the strongest tests we have to detect mutagenic substances. It uses specially engineered strains of Salmonella bacteria. In the wild, all Salmonella are able to synthesize their own histidine, which is an essential nutrient necessary for various cell functions. Without the ability to synthesize its own histidine, the bacteria become vulnerably dependent on an external supply. 

<!-- - [ ] What is a mutagen? … -->

The special strains used in the Ames test have artificial mutations making them unable to synthesize their own histidine. This means that these special strains cannot survive without a consistent external supply of histidine. In an Ames test, we expose these variant strains to our test substance, and let them grow in an environment where is scarce. If the substance is mutagenic, it will mutate the bacteria’s DNA causing our engineered mutations to be reversed and cure the bacteria of their inability. These “revertant” bacteria will be able to survive and thrive despite of the scarcity of histidine. If the substance is not mutagenic, most of the bacteria will die since they won’t be able to revert our mutations.

The Ames test uses a multiple of such genetically engineered strains of the bacteria. These strains are so specialized that even their names start with the label “TA” which stands for “*typhimurium Ames*”.

In order to produce histidine, the bacteria doesn’t just employ a single gene. In fact, it needs a complex network of genes to run in the correct order. This network of genes (which is required to fulfill a metabolic function) is called an *operon*. Each strain has a different mutation in a unique part of the histidine operon. These variations make it possible to detect a diverse set of mutation types.

<!-- - [ ] Which strain of *Salmonella* is used in Ames test? *Salmonella typhimurium*.
- [ ] What is an operon? … -->

We obtain a “positive” result from an Ames test, when a mutagen is able to induce mutation in the test bacteria, to reverse the “engineered” mutations and turn them into the histidine-independent (or, $his^+$) wild type. The Ames test assesses this by counting how many bacteria are able to survive in a environment lacking histidine by synthesizing their own.

The Ames is a “reverse-mutation” assay, which means that it detects mutagenic by detecting which mutations have been reversed.

However, in each batch some number of bacteria revert “spontaneously”. This complicates the Ames test, needing the use of a control batch that the test batch can be compared against, to account for the spontaneous reversions. The spontaneous reversion frequency is fairly consistent and well-known for each of the TA strains. However, there are lab-to-lab and day-to-day variants, requiring each lab to maintain a record of historical control values.

<!-- - [ ] What is the general range or standard deviation for the “spontaneous revertant” frequency? -->

The strains used by Ames had two key features. First, each strain was designed to detect different kind of frameshift mutations and base-pair mutations. Since each strain has different mutations in its histidine operon the “reversion mutation” needed to undo them are also different.

<!-- - [ ] What is a point mutation? Is it the same as one base pair mutation?
- [ ] What is a frameshift mutation? -->

Some substances that were intermediate products of eukaryotic metabolic processes were also known to be mutagenic. Thus, Ames also added mammalian liver microsomes to simulate mammalian metabolic reactions.

<!-- - [ ] What are these metabolic activation systems? And, why are they needed?
- [ ] What are these metabolic processes? -->

Second, the strains are engineered to have an increased sensitivity for mutagenic substances. These strains were handicapped by disabling certain DNA repair systems, making their cell walls more permeable. For example,

### The politics around the Ames test

The Ames test became mandatory when new legislation regulating carcinogens came about.

The Ames test came into popularity amidst two growing activist movements:

- Environmental activism against lack of safety concerns regarding the public health from chemicals created by corporations.
- Activism against potentially harmful science such as recombinant DNA.

The period of 1970s and 80s was a complicated time from a public relations standpoint for the molecular biology community. The recent rise of recombinant DNA technology was causing massive levels of public paranoia and fear.

Ames started out as a friend of the environmentalists, when his test identified that a bunch of chemicals used by companies were carcinogenic/mutagenic. Ames test helped build regulatory pressure against big corporations and bring about much stricter regulation. However, the environmentalists felt betrayed when Ames started suggesting that from a mutagenic perspective natural chemicals (that we can get from food) and synthetic chemicals (made by big corporations) were the same. That most of the mutagens we were facing on a day to day basis came from vegetables. That their activism was wasted fighting against rare chemical exposures manufactured by a few chemical companies, and would be better spent on “smoking” and other more common health hazards.

The Ames test came around a time, when the role of mutagens in carcinogens as carcinogens was no longer ignored. Cancer was thought to be the result of one of two kinds of mutations: germ-line (genetic) mutation or somatic mutation. Ames moved forward our understanding of mutagens as carcinogens by explaining mutagens acting to create somatic mutations. 