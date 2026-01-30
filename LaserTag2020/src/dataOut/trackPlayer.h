#ifndef _TRACK_PLAYER_
#define _TRACK_PLAYER_

#include "ofMain.h"
#include <sys/types.h>
#include <signal.h>

// Audio player using separate process (afplay) to avoid AVFoundation conflicts
class trackPlayer{
public:

    trackPlayer();
    ~trackPlayer();

    int 	loadTracks(string directoryPath);
    bool 	playTrack(int _whichTrack);
    string 	getCurrentTrackName();
    int 	getCurrentTrackNo();
    int 	getNumTracks();
    void 	pause();
    void 	unPause();
    bool 	getFinished();
    int 	nextTrack();
    int 	prevTrack();
    void 	setVolume(int vol);
    void 	setPitch(float pitch);
    void 	updatePitch(float pct);
    void 	shiftPos(float posAdj);
    void    stop();

protected:
    int  numTracks, whichTrack;
    float targetPitch, updatePct, currentPitch;
    int currentVolume;
    bool isPaused;
    float playStartTime;  // Time when playback started (for race condition prevention)

    ofDirectory DLIST;
    pid_t audioProcessPid;  // PID of afplay subprocess

    void killAudioProcess();
    void spawnAudioProcess(const string& filepath);
};

#endif
