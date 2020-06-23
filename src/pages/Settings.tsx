import React from 'react';
import { IonButtons, IonBackButton, IonPage, IonHeader, IonToolbar, IonTitle, IonContent, IonInput, IonLabel, IonItem, IonItemGroup } from '@ionic/react';
import { SERVER_ADDRESS_KEY, USER_NAME_KEY, SESSION_NAME_KEY } from '../App';
import { useStorageItem } from '@ionic/react-hooks/storage';

const Settings: React.FC = () => {
  const [ serverAddress, setServerAddress ] = useStorageItem(SERVER_ADDRESS_KEY, null);
  const [ userName, setUserName ] = useStorageItem(USER_NAME_KEY, null);
  const [ sessionName, setSessionName ] = useStorageItem(SESSION_NAME_KEY, null);

  const setItem = (fn: (value: any) => any) => (event: any) => {
    fn(event.target.value);
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar color='dark'>
          <IonButtons slot='start'>
            <IonBackButton defaultHref='/home' />
          </IonButtons>
          <IonTitle>Settings</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent>
        <IonItemGroup>
          <IonItem>
            <IonLabel position='floating'>Server address</IonLabel>
            <IonInput value={serverAddress} onIonInput={setItem(setServerAddress)}></IonInput>
          </IonItem>
          <IonItem>
            <IonLabel position='floating'>User name</IonLabel>
            <IonInput value={userName} onIonInput={setItem(setUserName)}></IonInput>
          </IonItem>
          <IonItem>
            <IonLabel position='floating'>Session name</IonLabel>
            <IonInput value={sessionName} onIonInput={setItem(setSessionName)}></IonInput>
          </IonItem>
        </IonItemGroup>
      </IonContent>
    </IonPage>
  );
};

export default Settings;
