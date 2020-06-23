import {
  IonContent,
  IonHeader,
  IonPage,
  IonTitle,
  IonToolbar,
  IonButtons,
  IonButton,
  IonIcon,
  IonPopover,
  IonItem,
  withIonLifeCycle,
  IonToast,
  IonImg
} from '@ionic/react';
import React from 'react';
import './Home.css';
import { ellipsisVertical } from 'ionicons/icons';
import { SERVER_ADDRESS_KEY, USER_NAME_KEY, SESSION_NAME_KEY } from '../App';
import { OpenVidu, Session, Publisher, Device, Connection } from 'openvidu-browser';
import { getToken } from '../util/http';
import { withRouter } from 'react-router';
import background from '../assets/background.jpg';
import { AndroidPermissions } from '@ionic-native/android-permissions';
import { Device as dev } from '@ionic-native/device';
import { BackgroundMode } from '@ionic-native/background-mode';
import { ForegroundService } from '@ionic-native/foreground-service';
import { BatteryStatus, BatteryStatusResponse } from '@ionic-native/battery-status';
import { Plugins } from '@capacitor/core';

const { Storage } = Plugins;

enum PlayState {
  ACTIVE = '#00ff0040',
  NOT_PLAYING = '#00000000',
  PREPAIRING = '#ffff0040'
};

type PopoverState = {
  show: boolean,
  event?: any
};

type ToastState = {
  active: boolean,
  message?: string
};

type HomeState = {
  popover: PopoverState,
  toast: ToastState,
  playButton: PlayState
}

enum SignalType {
  UPDATE_CAMERA = 'update-camera',
  FLIP_SOUND = 'flip-sound',
  DISCONNECT = 'disconnect',
  FETCH_STATUS = 'fetch-status',
  PUSH_STATUS = 'push-status'
};

type StaticData = {
  deviceInfo: {
    name: string,
    model: string,
    manufacturer: string,
    serial: string
  },
  videoDevices: Device[]
};

type DynamicData = {
  withAudio: boolean,
  videoDeviceId: string,
  zoom?: any,
  focus?: any,
  contrast?: any,
  brightness?: any,
  battery?: BatteryStatusResponse
};

const LAST_VIDEO_DEVICE = 'last-video-device';

class Home extends React.Component<any, HomeState> {
  private OV: OpenVidu = new OpenVidu();
  private serverAddress: string | null = null;
  private userName: string | null = null;
  private sessionName: string | null = null;
  private session: Session | undefined;
  private publisher: Publisher | undefined;
  private batteryStatus: BatteryStatusResponse | undefined;
  private taskId: any;

  constructor(props: any) {
    super(props);
    this.state = {
      popover: {
        show: false
      },
      playButton: PlayState.NOT_PLAYING,
      toast: {
        active: false
      }
    };

    this.playButtonClicked = this.playButtonClicked.bind(this);
    this.popoverClicked = this.popoverClicked.bind(this);
    this.settingsButtonClicked = this.settingsButtonClicked.bind(this);
    this.leaveSession = this.leaveSession.bind(this);
    this.flipSound = this.flipSound.bind(this);
    this.signalCurrentStatus = this.signalCurrentStatus.bind(this);
    this.hideToast = this.hideToast.bind(this);
  }

  public async ionViewDidEnter() {
    this.serverAddress = (await Storage.get({ key: SERVER_ADDRESS_KEY })).value;
    this.userName = (await Storage.get({ key: USER_NAME_KEY })).value;
    this.sessionName = (await Storage.get({ key: SESSION_NAME_KEY })).value;
  }

  async checkPermissions() {
    const permissions = [
      AndroidPermissions.PERMISSION.CAMERA,
      AndroidPermissions.PERMISSION.RECORD_AUDIO,
      AndroidPermissions.PERMISSION.MODIFY_AUDIO_SETTINGS
    ];

    const request = [];

    for (const permission of permissions) {
      const response = await AndroidPermissions.checkPermission(permission);
      if (!response.hasPermission) {
        request.push(permission);
      }
    }

    if (request.length !== 0) {
      await AndroidPermissions.requestPermissions(request);
    }
  }

  async getVideoDevices() {
    const devices = await this.OV.getDevices();
    return devices.filter(device => device.kind === 'videoinput');
  }

  componentDidMount() {
    document.addEventListener('deviceready', () => {
      BackgroundMode.enable();
      BackgroundMode.disableBatteryOptimizations();
      BatteryStatus.onChange().subscribe(status => {
        this.batteryStatus = status;
        this.signalCurrentStatus();
      });
    });
    //BackgroundMode.overrideBackButton();
    /*BackgroundMode.on('activate').subscribe(() => BackgroundMode.configure({
      title: 'reader',
      text: 'reader',
      resume: true,
      hidden: false,
      silent: false
    }));*/
  }

  isFirstLaunch(): boolean {
    return this.serverAddress === null || this.userName === null || this.sessionName === null;
  }

  setPopover(popoverState: PopoverState) {
    this.setState((state: any) => (
      {...state, popover: popoverState}
    ));
  }

  setPlay(playState: PlayState) {
    this.setState((state: any) => (
      { ...state, playButton: playState}
    ));
  }

  async updateVideoDevice(newConstraints: MediaTrackConstraints, hard: boolean) {
    const connection = this.publisher?.stream.getRTCPeerConnection();
    const senders = connection?.getSenders()!;
    const videoSender = senders?.filter(sender => sender.track?.kind === 'video')[0];
    const mediaStream = this.publisher?.stream.getMediaStream();
    const videoTrack = mediaStream?.getVideoTracks()[0];
    const oldConstraints = videoTrack?.getConstraints();

    if (hard) {
      videoTrack?.stop();
      mediaStream?.removeTrack(videoTrack!);

      const track = (await navigator.mediaDevices.getUserMedia({
        video: { ...oldConstraints, ...newConstraints }
      })).getVideoTracks()[0];

      mediaStream?.addTrack(track);
      await videoSender.replaceTrack(track);
    } else {
      videoTrack?.applyConstraints({ ...oldConstraints, ...newConstraints });
    }

    await this.signalCurrentStatus();
  }

  async flipSound() {
    this.publisher?.publishAudio(!this.publisher.stream.audioActive);
    await this.signalCurrentStatus();
    /*const stream = this.publisher?.stream.getMediaStream()!;
    const track = stream.getAudioTracks()[0]!;
    track.enabled = this.withAudio;*/
  }

  async signalCurrentStatus(to?: Connection) {
    await this.session?.signal({
      data: JSON.stringify(await this.getDynamicData()),
      to: to ? [to] : [],
      type: SignalType.PUSH_STATUS
    });
  }

  registerSignals() {
    this.session?.on(`signal:${SignalType.UPDATE_CAMERA}`, async (e: any) => {
      const constraints = JSON.parse(e.data) as MediaTrackConstraints;
      this.updateVideoDevice(constraints, constraints.deviceId !== undefined);
      if (constraints.deviceId !== undefined) {
        const videoDevices = await this.getVideoDevices();
        const deviceIndex = videoDevices.findIndex(device => device.deviceId === constraints.deviceId);
        Storage.set({ key: LAST_VIDEO_DEVICE, value: `${deviceIndex}` })
      }
    });
    this.session?.on(`signal:${SignalType.FLIP_SOUND}`, this.flipSound);
    this.session?.on(`signal:${SignalType.DISCONNECT}`, this.leaveSession);
    this.session?.on(`signal:${SignalType.FETCH_STATUS}`, (event: any) => (
      this.signalCurrentStatus(event.from)
    ));
  }

  async getStaticData(): Promise<StaticData> {
    return {
      deviceInfo: {
        name: this.userName!,
        model: dev.model,
        manufacturer: dev.manufacturer,
        serial: dev.serial
      },
      videoDevices: await this.getVideoDevices()
    };
  }

  async getDynamicData(): Promise<DynamicData> {
    // Can only be called when publisher is active
    await new Promise(r => setTimeout(r, 1000));

    const withAudio = this.publisher?.stream.audioActive!;
    const videoTrack = this.publisher?.stream
      .getMediaStream()
      .getVideoTracks()[0];

    const videoDeviceId = videoTrack?.getSettings().deviceId!;

    const capabilities = videoTrack?.getCapabilities()! as any;
    console.log(capabilities);
    console.log(videoTrack?.getSettings());
    console.log(videoTrack?.getConstraints());

    const zoom = capabilities.zoom
      ? {
          min: capabilities.zoom.min,
          max: capabilities.zoom.max,
          step: capabilities.zoom.step
        }
      : undefined;
    const focus = capabilities.focusDistance
      ? {
          min: capabilities.focusDistance.min,
          max: capabilities.focusDistance.max,
          step: capabilities.focusDistance.step
        }
      : undefined;
    const brightness = capabilities.brightness
      ? {
          min: capabilities.brightness.min,
          max: capabilities.brightness.max,
          step: capabilities.brightness.step
        }
      : undefined;
    const contrast = capabilities.contrast
      ? {
          min: capabilities.contrast.min,
          max: capabilities.contrast.max,
          step: capabilities.contrast.step
        }
      : undefined;


    return { withAudio, videoDeviceId, zoom, focus, brightness, contrast, battery: this.batteryStatus };
  }

  async startSession() {
    this.setPlay(PlayState.PREPAIRING);
    this.session = this.OV.initSession();

    try {
      const token = await getToken(this.serverAddress!, this.sessionName!);
      await this.session?.connect(token, JSON.stringify(await this.getStaticData()));
      this.registerSignals();
      this.initPublisher();
      this.setPlay(PlayState.ACTIVE);
    } catch (e) {
      console.error('can\'t create session');
      console.log(e);
      this.setPlay(PlayState.NOT_PLAYING);
      this.showToast('Server is not available');
    }
  }

  unpublish() {
    if (this.publisher) {
      this.session?.unpublish(this.publisher);
      this.publisher = undefined;
    }
  }

  leaveSession() {
    this.unpublish();
    this.session?.disconnect();
    this.session = undefined;
    this.setPlay(PlayState.NOT_PLAYING);
  }

  async playButtonClicked() {
    if (this.isFirstLaunch()) {
      this.props.history.push('/settings');
      return;
    }

    await this.checkPermissions();
    switch (this.state.playButton) {
      case PlayState.NOT_PLAYING:
        this.startSession();
        //ForegroundService.start('Reader', 'Reader is working');
        /*this.taskId = BackgroundTask.beforeExit(async () => {
          this.startSession();
        });*/
        break;
      case PlayState.ACTIVE:
        this.leaveSession();
        //ForegroundService.stop();
        break;
    }
  }

  async initPublisher() {
    const publisher = await this.OV.initPublisherAsync(undefined as any, {
      publishAudio: true,
      publishVideo: true,
      frameRate: 30
    });

    await this.session?.publish(publisher!);
    publisher.publishAudio(false);
    this.publisher = publisher;

    const lastVideoDevice = (await Storage.get({ key: LAST_VIDEO_DEVICE })).value;
    if (lastVideoDevice !== null) {
      const videoDevices = await this.getVideoDevices();
      this.updateVideoDevice({ deviceId: videoDevices[+lastVideoDevice].deviceId }, true);
    }
  }

  settingsButtonClicked() {
    this.setPopover({ show: false });
  }

  popoverClicked(event: any) {
    event.persist();
    this.setPopover({ show: true, event });
  }

  showToast(message: string) {
    this.setState(state => ({
      ...state,
      toast: {
        active: true,
        message
      }
    }));
  }

  hideToast() {
    this.setState(state => (
      { ...state, toast: { active: false }}
    ));
  }

  render() {
    return (
      <IonPage>
      <IonHeader>
        <IonToolbar color='dark'>
          <IonButtons slot='end'>
            <IonPopover
              isOpen={this.state.popover.show}
              event={this.state.popover.event}
              onDidDismiss={() => this.setPopover({ show: false })}
            >
              <IonItem routerLink='/settings' onClick={this.settingsButtonClicked}>Settings</IonItem>
            </IonPopover>
            <IonButton shape='round' onClick={this.popoverClicked}>
              <IonIcon icon={ellipsisVertical} />
            </IonButton>
          </IonButtons>
          <IonTitle slot='start'>Reader</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent>
        <IonToast
          isOpen={this.state.toast.active}
          message={this.state.toast.message}
          position='bottom'
          onDidDismiss={this.hideToast}
          duration={6000}
        />
        <IonImg src={background} className='background-img' />
        <div className='secret-button' onClick={this.playButtonClicked} style={{ backgroundColor: this.state.playButton }} />
      </IonContent>
    </IonPage>
    );
  }
}

export default withRouter(withIonLifeCycle(Home));
