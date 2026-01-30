#ifndef _TEST_APP
#define _TEST_APP


#include "ofMain.h"
#include "appController.h"

class ofApp : public ofBaseApp {

public:

	void setup();
    void setupProjector();
	void update();
	void draw();
	void drawProjector(ofEventArgs& args);
	void init();
    void exit();

    void windowResized(int w, int h);
    void preDrawScale(ofEventArgs& args);
    void postDrawScale(ofEventArgs& args);
    void scaleMouseCoords(ofMouseEventArgs& mouse);

	void keyPressed(ofKeyEventArgs& key);
	void keyReleased(ofKeyEventArgs& key);

	void mouseDragged(ofMouseEventArgs& mouse);
	void mousePressed(ofMouseEventArgs& mouse);
	void mouseReleased(ofMouseEventArgs& mouse);

    void keyPressedProjector(ofKeyEventArgs& key);
    void mouseDraggedProjector(ofMouseEventArgs& mouse);
    void mousePressedProjector(ofMouseEventArgs& mouse);
    void mouseReleasedProjector(ofMouseEventArgs& mouse);

	float 	counter;
	float	spin;
	float	spinPct;
	int		prevMX;
	int		prevMY;
	bool 	bFirstMouseMove;

    float uiScale;
    int baseWidth;
    int baseHeight;

	appController appCtrl;

};

#endif	
