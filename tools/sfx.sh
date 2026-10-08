#!/bin/sh
# Convert the chosen Kenney CC0 sounds (local packs from sibling projects) to small mono mp3s in assets/sfx.
set -e
cd "$(dirname "$0")/.."
K=../tawid-edsa/.scratch/kenney
UI=$K/kenney_interface-sounds/Audio IM=$K/kenney_impact-sounds/Audio JG="$K/kenney_music-jingles/Audio/Pizzicato jingles" RPG=$K/kenney_rpg-audio/Audio CAS=../isang-tira/.scratch/kenney/casino
[ -d "$UI" ] || UI=$(dirname "$(find $K/kenney_interface-sounds -name 'drop_001.ogg' | head -1)")
[ -d "$IM" ] || IM=$(dirname "$(find $K/kenney_impact-sounds -name 'impactBell_heavy_000.ogg' | head -1)")
[ -d "$RPG" ] || RPG=$(dirname "$(find $K/kenney_rpg-audio -name 'handleCoins.ogg' | head -1)")
CAS=$(dirname "$(find $CAS -name 'card-shuffle.ogg' | head -1)")
mp3() { ffmpeg -v error -y -i "$1" -ac 1 -b:a 96k "assets/sfx/$2.mp3"; }
for n in 1 2 3 4; do mp3 "$UI/drop_00$n.ogg" pop$n; done
for n in 1 2 3; do mp3 "$UI/select_00$n.ogg" select$n; mp3 "$UI/click_00$n.ogg" click$n; done
mp3 "$UI/error_004.ogg" tsk
for n in 1 2 3; do mp3 "$UI/maximize_00$n.ogg" special$n; done
for n in 1 2 3 4 5 6; do mp3 "$UI/glass_00$n.ogg" glass$n; done
mp3 "$UI/bong_001.ogg" start
for n in 1 2 3 4; do mp3 "$CAS/card-slide-$n.ogg" swap$n; done
for n in 1 2 3 4 5 6; do mp3 "$CAS/chips-stack-$n.ogg" chips$n; done
for n in 1 2 3; do mp3 "$CAS/chips-handle-$n.ogg" handle$n; done
mp3 "$CAS/card-shuffle.ogg" shuffle
for n in 0 1 2; do mp3 "$IM/impactBell_heavy_00$n.ogg" kaldero$n; mp3 "$IM/footstep_snow_00$n.ogg" latik$n; done
for n in 1 2 3; do mp3 "$RPG/drawKnife$n.ogg" sandok$n; done
for n in 1 2 3; do mp3 "$RPG/cloth$n.ogg" cloth$n; done
for n in 0 1 2; do mp3 "$IM/impactPlank_medium_00$n.ogg" plank$n; mp3 "$IM/footstep_grass_00$n.ogg" rustle$n; mp3 "$IM/impactSoft_medium_00$n.ogg" thud$n; done
mp3 "$RPG/handleCoins.ogg" coin1; mp3 "$RPG/handleCoins2.ogg" coin2
mp3 "$JG/jingles_PIZZI02.ogg" win; mp3 "$JG/jingles_PIZZI01.ogg" lose; mp3 "$JG/jingles_PIZZI00.ogg" star3; mp3 "$JG/jingles_PIZZI15.ogg" go
cp "$(find $K/kenney_interface-sounds -name 'License.txt' | head -1)" assets/sfx/LICENSE-kenney-interface.txt
cp "$(find $K/kenney_impact-sounds -name 'License.txt' | head -1)" assets/sfx/LICENSE-kenney-impact.txt
cp "$(find $K/kenney_music-jingles -name 'License.txt' | head -1)" assets/sfx/LICENSE-kenney-jingles.txt
cp "$(find $K/kenney_rpg-audio -name 'License.txt' | head -1)" assets/sfx/LICENSE-kenney-rpg.txt
cp "$(find ../isang-tira/.scratch/kenney/casino -iname 'License*.txt' | head -1)" assets/sfx/LICENSE-kenney-casino.txt 2>/dev/null || cp ../isang-tira/assets/sfx/LICENSE-kenney-casino.txt assets/sfx/
