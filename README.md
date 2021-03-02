# PDF Show Combiner

As a musician in a show (such as musical or revy) you want to have your sheet music and cues as easily accessible as possible. This repo enables you to combine several PDFs into one big PDF with additional annotations such as cues, tempo and patch information.

## Installation

You need to install the Javascript and Typescript runtime [Deno](https://deno.land/). 

### macOS
On macOS I recommend you to download this tool with Homebrew:

```bash
brew install deno
```

### Other OSes

Look at the [official installation instructions on deno.land.](https://deno.land/#installation)


## Usage

You need to organize the organize the musical pieces in this folder structure:

```
path_to_songs
├── type_name1
│   ├── song1
│   │   ├── song1_bass.pdf
│   │   ├── song1_drums.pdf
│   │   └── song1_gitar.pdf
│   └── song2
│       └── ...
└── type_name2
    ├── musical_song_1
    │   └── ...
    └── musical_song_2
        └── ...
```

And create the cues and order of the songs with the same structure as [this template.](https://docs.google.com/spreadsheets/d/1i5ysWpd105U83bJNGoY42axgft93-xKsOUY6JhcZg10/edit?usp=sharing)

Download the Google Sheet file as a `.tsv` file.

Now you can run the run the script to create the combined PDF:

```bash
deno run --unstable --allow-read --allow-write mod.ts --performer performer1 --tsv path_to_tsv.tsv --folder path_to_songs
```

The combined file will be called `<performer>.pdf`.
