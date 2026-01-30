#include "trackPlayer.h"
#include <unistd.h>
#include <sys/wait.h>
#include <spawn.h>

extern char **environ;

// ------------------------
trackPlayer::trackPlayer(){
    whichTrack = -1;
    numTracks  = 0;
    audioProcessPid = 0;
    currentVolume = 80;
    isPaused = false;
    playStartTime = 0;
}

trackPlayer::~trackPlayer(){
    killAudioProcess();
}

//-------------------------
void trackPlayer::killAudioProcess(){
    if(audioProcessPid > 0){
        // Kill the afplay process and any children
        kill(audioProcessPid, SIGTERM);
        // Wait briefly then force kill if needed
        usleep(50000);  // 50ms
        kill(audioProcessPid, SIGKILL);
        waitpid(audioProcessPid, nullptr, WNOHANG);
        audioProcessPid = 0;
    }
}

//-------------------------
void trackPlayer::spawnAudioProcess(const string& filepath){
    killAudioProcess();  // Stop any existing playback

    // Mark playback start time to prevent race condition in getFinished()
    playStartTime = ofGetElapsedTimef();

    // Use system() with background execution - simpler and may avoid issues
    float vol = currentVolume / 100.0f;
    string cmd = "afplay -v " + ofToString(vol) + " \"" + filepath + "\" &";
    ofLogNotice("trackPlayer") << "Running: " << cmd;
    int result = system(cmd.c_str());

    // Get the PID of the background process (approximate - get most recent afplay)
    FILE* fp = popen("pgrep -n afplay", "r");
    if(fp){
        char buf[32];
        if(fgets(buf, sizeof(buf), fp)){
            audioProcessPid = atoi(buf);
            ofLogNotice("trackPlayer") << "afplay PID: " << audioProcessPid;
        }
        pclose(fp);
    }
    isPaused = false;
}

//-------------------------
int trackPlayer::loadTracks(string directoryPath){
    DLIST.allowExt("mp3");
    DLIST.allowExt("wav");
    DLIST.allowExt("aiff");
    DLIST.allowExt("m4a");
    numTracks = DLIST.listDir(directoryPath);
    DLIST.sort();
    ofLogNotice("trackPlayer") << "Loaded " << numTracks << " tracks from " << directoryPath;
    for(int i = 0; i < numTracks; i++){
        ofLogNotice("trackPlayer") << "  Track " << i << ": " << DLIST.getPath(i);
    }
    return numTracks;
}

//-------------------------
bool trackPlayer::playTrack(int _whichTrack){
    if(numTracks == 0 || _whichTrack >= numTracks || _whichTrack < 0) return false;

    whichTrack = _whichTrack;

    targetPitch  = 1.0;
    currentPitch = 1.0;

    string filepath = DLIST.getPath(whichTrack);
    ofLogNotice("trackPlayer") << "Playing track: " << filepath;
    spawnAudioProcess(filepath);
    ofLogNotice("trackPlayer") << "Spawned afplay with PID: " << audioProcessPid;

    return true;
}

//-------------------------
string trackPlayer::getCurrentTrackName(){
    if(numTracks == 0 || whichTrack >= numTracks || whichTrack < 0) return "";
    return DLIST.getName(whichTrack);
}

//-------------------------
int trackPlayer::getCurrentTrackNo(){
    return whichTrack;
}

//-------------------------
int trackPlayer::getNumTracks(){
    return numTracks;
}

//-------------------------
void trackPlayer::pause(){
    if(audioProcessPid > 0 && !isPaused){
        kill(audioProcessPid, SIGSTOP);
        isPaused = true;
    }
}

//-------------------------
void trackPlayer::unPause(){
    if(audioProcessPid > 0 && isPaused){
        kill(audioProcessPid, SIGCONT);
        isPaused = false;
    }
}

//-------------------------
bool trackPlayer::getFinished(){
    // Prevent race condition: don't report finished within first second of playback
    // This gives time for the afplay process to start and pgrep to capture its PID
    if(playStartTime > 0 && (ofGetElapsedTimef() - playStartTime) < 1.0f){
        return false;
    }

    if(audioProcessPid <= 0) return true;

    // Check if process is still running
    int status;
    pid_t result = waitpid(audioProcessPid, &status, WNOHANG);
    if(result == audioProcessPid){
        // Process has exited
        audioProcessPid = 0;
        return true;
    }
    return false;
}

//-------------------------
int trackPlayer::nextTrack(){
    whichTrack += 1;
    if(whichTrack >= numTracks) whichTrack = 0;
    playTrack(whichTrack);

    return whichTrack;
}

//-------------------------
int trackPlayer::prevTrack(){
    whichTrack--;
    if(whichTrack < 0) whichTrack = numTracks - 1;
    playTrack(whichTrack);

    return whichTrack;
}

//-------------------------
void trackPlayer::setVolume(int vol){
    int newVol = vol;
    if(newVol > 100) newVol = 100;
    if(newVol < 0) newVol = 0;

    // afplay doesn't support runtime volume changes, so we need to restart
    // Only restart if volume actually changed and currently playing
    if(newVol != currentVolume && audioProcessPid > 0 && whichTrack >= 0){
        currentVolume = newVol;
        // Restart with new volume
        playTrack(whichTrack);
    } else {
        currentVolume = newVol;
    }
}

//-------------------------
void trackPlayer::setPitch(float pitch){
    // afplay doesn't support pitch changes
    currentPitch = pitch;
}

//-------------------------
void trackPlayer::updatePitch(float pct){
    // afplay doesn't support pitch changes
    currentPitch *= pct;
    currentPitch += (1.0-pct);
}

//-------------------------
void trackPlayer::shiftPos(float posAdj){
    // afplay doesn't support seeking - would need to restart
    // Not implementing for now
}

void trackPlayer::stop(){
    killAudioProcess();
}
