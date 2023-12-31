import { formatDate } from '@angular/common';
import { Component, ElementRef, HostListener, OnInit, ViewChild } from '@angular/core';
import { Router } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import * as Chart from 'chart.js';
import { ToastrService } from 'ngx-toastr';
import { AppointmentService } from 'src/app/appointment/appointment.service';
import { HeaderService } from 'src/app/Headers/header/header.service';
import { ConversationService } from 'src/app/services/conversation.service';
import { NotificationService } from 'src/app/services/notification.service';
import { PrescriptionService } from 'src/app/services/prescription.service';
import { QuestionService } from 'src/app/services/question.service';
import { RateService } from 'src/app/services/rate.service';
import { UserService } from 'src/app/services/user.service';
import { WebSocketService } from 'src/app/services/web-socket.service';
import { AppointmentDocInfoGet } from 'src/model/AppointmentDocInfoGet';
import { AppointmentGet } from 'src/model/AppointmentGet';
import { Conversation } from 'src/model/Conversation';
import { ConversationGet } from 'src/model/ConversationGet';
import { DoctorInfoForPatient } from 'src/model/DoctorInfoForPatient';
import { HeightValues } from 'src/model/HeightValues';
import { IdAndBoolean } from 'src/model/IdAndBoolean';
import { IntegerAndStringPost } from 'src/model/IntegerAndStringPost';
import { medicalProfileDiseaseGet } from 'src/model/medicalProfileDiseaseGet';
import { medicalProfileGet } from 'src/model/medicalProfileGet';
import { MessageGet } from 'src/model/MessageGet';
import { MyUserWithPag } from 'src/model/MyUserWithPag';
import { NotificationGet } from 'src/model/NotificationGet';
import { OpenConversation } from 'src/model/OpenConversation';
import { PatientGet } from 'src/model/PatientGet';
import { PatientPostWithSecureLogin } from 'src/model/PatientPostWithSecureLogin';
import { PharmacyGet } from 'src/model/PharmacyGet';
import { prescriptionGet } from 'src/model/prescriptionGet';
import { QuestionGet } from 'src/model/QuestionGet';
import { SecureLoginString } from 'src/model/SecureLoginString';
import { StringGet } from 'src/model/StringGet';
import { TwoStringsPost } from 'src/model/TwoStringsPost';
import { UpdateMedicalProfilePost } from 'src/model/UpdateMedicalProfilePost';
import { UpdatePasswordPost } from 'src/model/UpdatePasswordPost';
import { UserSearchGet } from 'src/model/UserSearchGet';
import { WebSocketNotification } from 'src/model/WebSocketNotification';
import { WeightValues } from 'src/model/WeightValues';
import { DoctorService } from '../../doctor/doctor/doctor.service';
import { PharmacyService } from '../../pharmacy/pharmacy.service';
import { PatientService } from './patient.service';
import jwt_decode from 'jwt-decode';
import { environment } from 'src/environments/environment.prod';
import { StringAndTwoDoublePost } from 'src/model/StringAndTwoDoublePost';

declare const L: any;

@Component({
  selector: 'app-patient',
  templateUrl: './patient.component.html',
  styleUrls: ['./patient.component.css']
})
export class PatientComponent implements OnInit {

  slectedDay: boolean = true;
  monthDays: any[] = [];
  monthDaysDis: boolean[] = [];
  daysNameEn: string[] = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  daysName: string[] = [];
  daysNameDouble: string[] = [];
  date: Date = new Date();
  today: number = /*28;*/this.date.getUTCDate();
  todayName: string;
  todayNumber: number;
  utcYear: number = this.date.getUTCFullYear();
  utcMonth: number = this.date.getUTCMonth() + 1;
  lastMonthDay: number;
  integerAndStringPost: IntegerAndStringPost;
  appointmentMonth: number;
  appointmentYear: number;
  appointmentDay: number;
  appointmentDate: string;
  appointmentPage: number = 0;
  prescriptionPharmacies: PharmacyGet[] = [];

  constructor(private patientService: PatientService,
    private translate: TranslateService,
    private toastr: ToastrService,
    private router: Router,
    private doctorService: DoctorService,
    private appointmentService: AppointmentService,
    private userService: UserService,
    private prescriptionService: PrescriptionService,
    private headerService: HeaderService,
    private notificationService: NotificationService,
    private pharmacyService: PharmacyService,
    private conversationService: ConversationService,
    private webSocketService: WebSocketService,
    private questionService: QuestionService,
    private rateService: RateService) {
    let stompClient = this.webSocketService.connect();
    stompClient.connect({}, frame => {

      // Subscribe to notification topic
      stompClient.subscribe('/topic/notification/' + this.patientGet.userId, async message => {
        let not: WebSocketNotification = JSON.parse(message.body);
        if (not.type == 'seen') {
          if (this.openConversation && this.openConversation.conversationId == parseInt(not.data))
            this.openConversation.isUnread = false;
          let data: IdAndBoolean = { id: parseInt(not.data), boolean: false, lastMessageSenderId: 0 };
          this.headerService.setReadConversation(data);
          this.scrollToBottomMessages();
        } else if (not.type == 'message') {
          if (this.openConversation && this.openConversation.conversationId == not.message.conversationId) {
            this.openConversation.isUnread = true;
            this.openConversation.lastMessageSenderId = not.message.senderId;
            this.openConversation.messages.push(not.message);
            await this.sleep(1);
            this.scrollToBottomMessages();
            this.messageSound();
            this.headerService.newMessage(not.message);
            this.headerService.setFirstConversation(not.message.conversationId);
          } else {
            this.newMessage += 1;
            let i: number = 0;
            for (let conv of this.smallConversations) {
              if (conv.conversationId == not.message.conversationId) {
                this.smallConversations[i].isUnread = true;
                this.smallConversations[i].lastMessageSenderId = not.message.senderId;
                let message: MessageGet = { messageContent: not.message.messageContent, senderId: not.message.senderId, recipientId: not.message.recipientId, messageDate: not.message.messageDate, conversationId: not.message.conversationId }
                this.smallConversations[i].messages.push(message);
                break;
              }
              i += 1;
            }
            this.toastr.info(this.translate.instant('newMessage'), this.translate.instant('Notification'), {
              timeOut: 5000,
              positionClass: 'toast-bottom-left'
            });
            this.notificationSound();
            this.headerService.setFirstConversation(not.message.conversationId);
            let data: IdAndBoolean = { id: not.message.conversationId, boolean: true, lastMessageSenderId: not.message.senderId };
            this.headerService.setReadConversation(data);
            this.headerService.newMessage(not.message);
          }
        } else if (not.type == 'notification') {
          not.notification.order = 'start';
          if (not.notification.notificationType == 'conversationclose') {
            this.toastr.info(not.data + ' ' + this.translate.instant('closeConversation'), this.translate.instant('Notification'), {
              timeOut: 5000,
              positionClass: 'toast-bottom-left'
            });

            if (this.openConversation && parseInt(not.notification.notificationParameter) == this.openConversation.conversationId) {
              this.openConversation.conversationStatus = 'close';
              this.openConversation.statusUpdatedBy = not.notification.senderId;
            } else if (this.smallConversations) {
              let i: number = 0;
              for (let conv of this.smallConversations) {
                if (conv.conversationId == parseInt(not.notification.notificationParameter)) {
                  this.smallConversations[i].conversationStatus = 'close';
                  this.smallConversations[i].statusUpdatedBy = not.notification.senderId;
                  break;
                }
                i = +1;
              }
            }

          } else if (not.notification.notificationType == 'conversationopen') {
            this.toastr.info(not.data + ' ' + this.translate.instant('openConversation'), this.translate.instant('Notification'), {
              timeOut: 5000,
              positionClass: 'toast-bottom-left'
            });

            if (this.openConversation && parseInt(not.notification.notificationParameter) == this.openConversation.conversationId) {
              this.openConversation.conversationStatus = 'open';
              this.openConversation.statusUpdatedBy = not.notification.senderId;
            } else if (this.smallConversations) {
              let i: number = 0;
              for (let conv of this.smallConversations) {
                if (conv.conversationId == parseInt(not.notification.notificationParameter)) {
                  this.smallConversations[i].conversationStatus = 'open';
                  this.smallConversations[i].statusUpdatedBy = not.notification.senderId;
                  break;
                }
                i = +1;
              }
            }

          } else if (not.notification.notificationType == 'patientTurnClose') {
            this.toastr.info(this.translate.instant('yourAppWithDoctor') + ' ' + not.data + ' ' + this.translate.instant('comeClose'), this.translate.instant('Notification'), {
              timeOut: 5000,
              positionClass: 'toast-bottom-left'
            });
          } else if (not.notification.notificationType == 'delayPatientTurn') {
            this.toastr.info(not.data + ' ' + this.translate.instant('postponeTheAppTo') + ' ' + not.notification.notificationParameter, this.translate.instant('Notification'), {
              timeOut: 5000,
              positionClass: 'toast-bottom-left'
            });
          } else if (not.notification.notificationType == 'doctorStartSession') {
            this.toastr.info(not.data + ' ' + this.translate.instant('beginReceivePat'), this.translate.instant('Notification'), {
              timeOut: 5000,
              positionClass: 'toast-bottom-left'
            });
          } else if (not.notification.notificationType == 'doctorDeletePrescription') {
            this.toastr.info(not.data + ' ' + this.translate.instant('delectedPres'), this.translate.instant('Notification'), {
              timeOut: 5000,
              positionClass: 'toast-bottom-left'
            });
            this.headerService.deletePrescriptionById(parseInt(not.notification.notificationParameter));
          } else if (not.notification.notificationType == 'doctorAddPrescription') {
            this.toastr.info(not.data + ' ' + this.translate.instant('addedPres'), this.translate.instant('Notification'), {
              timeOut: 5000,
              positionClass: 'toast-bottom-left'
            });
          } else if (not.notification.notificationType == 'secretaryConfirmAppointment') {
            this.toastr.info(this.translate.instant('yourAppWith') + ' ' + not.data + ' ' + this.translate.instant('confirmed'), this.translate.instant('Notification'), {
              timeOut: 5000,
              positionClass: 'toast-bottom-left'
            });
            let index: number = 0;
            for (let app of this.myAppointment) {
              if (app.appointmentId == parseInt(not.notification.notificationParameter)) {
                this.myAppointment.splice(index, 1);
                break;
              }
              index += 1;
            }
            this.getAppointmentById(parseInt(not.notification.notificationParameter));
          } else if (not.notification.notificationType == 'secretaryRefuseAppointment') {
            this.toastr.info(this.translate.instant('yourAppWith') + ' ' + not.data + ' ' + this.translate.instant('refused'), this.translate.instant('Notification'), {
              timeOut: 5000,
              positionClass: 'toast-bottom-left'
            });
            let index: number = 0;
            for (let app of this.myAppointment) {
              if (app.appointmentId == parseInt(not.notification.notificationParameter)) {
                this.myAppointment.splice(index, 1);
                break;
              }
              index += 1;
            }
            this.getAppointmentById(parseInt(not.notification.notificationParameter));
          } else if (not.notification.notificationType == 'secretaryConfirmAppDateChange') {
            this.toastr.info(not.data + ' ' + this.translate.instant('acceptChangeDateReq'), this.translate.instant('Notification'), {
              timeOut: 5000,
              positionClass: 'toast-bottom-left'
            });
            let index: number = 0;
            for (let app of this.myAppointment) {
              if (app.appointmentId == parseInt(not.notification.notificationParameter)) {
                this.myAppointment.splice(index, 1);
                break;
              }
              index += 1;
            }
            this.getAppointmentById(parseInt(not.notification.notificationParameter));
          } else if (not.notification.notificationType == 'secretaryRefuseAppDateChange') {
            this.toastr.info(not.data + ' ' + this.translate.instant('refuseChangeDateReq'), this.translate.instant('Notification'), {
              timeOut: 5000,
              positionClass: 'toast-bottom-left'
            });
            let index: number = 0;
            for (let app of this.myAppointment) {
              if (app.appointmentId == parseInt(not.notification.notificationParameter)) {
                this.myAppointment.splice(index, 1);
                break;
              }
              index += 1;
            }
            this.getAppointmentById(parseInt(not.notification.notificationParameter));
          } else if (not.notification.notificationType == 'appointmentTurnDecremented') {
            this.toastr.info(this.translate.instant('yourAppTurndec') + ' ' + not.data + ' ' + this.translate.instant('decremented'), this.translate.instant('Notification'), {
              timeOut: 5000,
              positionClass: 'toast-bottom-left'
            });
          } else if (not.notification.notificationType == 'patientAppCompleted') {
            let index = 0;
            for (let app of this.myAppointment) {
              if (app.appointmentId == parseInt(not.notification.notificationParameter)) {
                app.appointmentStatus = 'completed';
                break;
              }
              index += 1;
            }
            this.toastr.info(this.translate.instant('yourAppWithDoctor') + ' ' + not.data + ' ' + this.translate.instant('finished'), this.translate.instant('Notification'), {
              timeOut: 5000,
              positionClass: 'toast-bottom-left'
            });
          } else if (not.notification.notificationType == 'commentedYourPost') {
            let index = 0;
            this.toastr.info(not.data + ' ' + this.translate.instant('addCommentToYourPost'), this.translate.instant('Notification'), {
              timeOut: 5000,
              positionClass: 'toast-bottom-left'
            });
          }
          if (not.notification.notificationType != 'doctorDeletePrescription') {
            not.notification.name = not.data;
            this.headerService.addNotification(not.notification);
          }
          this.notificationSound();
        } else if (not.type == 'confirmPrescription') {
          for (let pres of this.prescriptions) {
            let i: number = 0;
            if (pres.prescriptionId == parseInt(not.data)) {
              this.prescription = 'all';
              this.prescriptions[i].prescriptionStatus = 'used';
            }
            i++;
          }
        }
      })
    });
  }
  patientPostWithSecureLogin: PatientPostWithSecureLogin;
  stringAndTwoDoublePost: StringAndTwoDoublePost;
  re = /^[A-Za-z]+$/;
  nb = /^\d+$/;
  er = new RegExp('^[0-9]+(\.[0-9]+)*$');
  secureLoginString: SecureLoginString;
  patientGet: PatientGet;
  generalInfo: string = 'show';
  maleCheckBox: boolean; femaleCheckBox: boolean;
  container: string = 'profile'; medicalProfileInfo: string = 'noData'; medicalProfile: string = 'showData'; prescriptionInfo: string = 'info';
  height: string; weight: string; firstName: string; lastName: string; mail: string; day: string; month: string; year: string; adress: string; password: string; passwordRepeat: string;
  heightInformation: string; weightInformation: string; passwordRepeatInfromation: string; passwordInfromation: string; firstNameInformation: string; lastNameInformation: string; mailInformation: string; dayInformation: string; monthInformation: string; yearInformation: string; adressInformation: string;
  invalidFirstNameVariable: boolean; invalidLastNameVariable: boolean; invalidMailVariable: boolean; invalidDayVariable: boolean; invalidMonthVariable: boolean; invalidYearVariable: boolean; invalidAdressVariable: boolean; invalidPasswordVariable: boolean; invalidPasswordRepeatVariable: boolean; invalidHeightVariable: boolean = false; invalidWeightVariable: boolean = false;
  disableSaveBtn: boolean = true;
  disableSaveMedicalProfileBtn: boolean = true;
  selectedFile: File;
  retrievedImage: any;
  base64Data: any;
  retrieveResonse: any;
  message: string;
  doctorProfileImg: any[] = [];
  appointmentDocInfoGet: AppointmentDocInfoGet[] = [];
  docInfoForPatient: DoctorInfoForPatient[] = [];
  patientInfo: boolean;
  showUpdateCalendar: boolean[];
  editeSecureInfo: boolean = false;
  editPassword: boolean;
  twoStringsPost: TwoStringsPost;
  disableChnageUsernameBtn: boolean = true;
  updatePasswordPost: UpdatePasswordPost;
  disableUpdateUsernamePassBtn: boolean = false;
  patientMedicalProfile: medicalProfileGet;
  updateMedicalProfilePost: UpdateMedicalProfilePost;
  cities: string[] = ["Ariana", this.translate.instant('Beja'), "Ben Arous", "Bizerte", this.translate.instant('Gabes'), "Gafsa", "Jendouba", "Kairouan", "Kasserine", this.translate.instant('Kebili'), "Kef", "Mahdia", "Manouba", this.translate.instant('Medenine'), "Monastir", "Nabeul", "Sfax", "Sidi Bouzid", "Siliana", "Sousse", "Tataouine", "Tozeur", "Tunis", "Zaghouan"];
  myAppointment: AppointmentGet[] = [];
  deletedApp: boolean[] = [];
  showLoadMoreApp: boolean;
  appointmentLoading: boolean = false;
  docProfileImages: boolean;
  docInfos: boolean;
  prescriptions: prescriptionGet[] = [];
  disPrescriptions: prescriptionGet[] = [];
  pendingPrescriptionPage: number = 0;
  loadMorePrescription: boolean;
  diseasePage: number = 0;
  medicalProfileDiseaseInfo: string = 'info';
  loadDoctorInfoForMedicalProfileDis: boolean[] = [];
  loadMoreDis: boolean;
  notificationPage: number = 0;
  showAllDisease: boolean = false;
  presKey: number;
  prescription: string = 'all';
  presPresKey: number;
  pharmacyPage: number = 0;
  loadMorePharmacies: boolean;
  pharmacyKey: number;
  loadingPh: boolean;
  notVerified: boolean;
  field1Code: string; field2Code: string; field3Code: string; field4Code: string; field5Code: string;
  isVerificationCode: boolean;
  conversationPage: number = 0;
  openConversation: OpenConversation;
  @ViewChild('messagesContainer') private messagesContainer: ElementRef;
  smallConversations: OpenConversation[] = [];
  loadingMessages: boolean = false;
  searchedUsers: UserSearchGet[] = [];
  loadMoreUsers: boolean;
  selectedUser: UserSearchGet;
  myMap;
  popUp: boolean = false;
  popUpTitle: string;
  popUpText: string;
  popUpFor: string;
  confirming: boolean = false;
  popUpValue1: string;
  popUpValue2: string;
  birthYears: number[] = [];
  newMessage: number = 0;

  lodadingAcountData: boolean = true;
  ngOnInit(): void {
    for (let i = 2021; i >= 1900; i--) {
      this.birthYears.push(i);
    }
    this.showUpdateCalendar = [false];
    this.patientInfo = false;
    this.getUserInfo();
  }

  @ViewChild('1') field1Input: ElementRef;
  @ViewChild('2') field2Input: ElementRef;
  @ViewChild('3') field3Input: ElementRef;
  @ViewChild('4') field4Input: ElementRef;
  @ViewChild('5') field5Input: ElementRef;

  field1Keyup() {
    if (this.field1Code.length == 1)
      this.field2Input.nativeElement.focus();
  }
  field2Keyup() {
    if (this.field2Code.length == 1)
      this.field3Input.nativeElement.focus();
    else
      this.field1Input.nativeElement.focus();
  }
  field3Keyup() {
    if (this.field3Code.length == 1)
      this.field4Input.nativeElement.focus();
    else
      this.field2Input.nativeElement.focus();
  }
  field4Keyup() {
    if (this.field4Code.length == 1)
      this.field5Input.nativeElement.focus();
    else
      this.field3Input.nativeElement.focus();
  }
  field5Keyup() {
    if (this.field5Code.length == 0)
      this.field4Input.nativeElement.focus();
  }

  checkForm() {
    this.checkFirstName();
    this.checkLastName();
    this.checkAdress();
    this.checkBirthday();
    if (!this.invalidAdressVariable && !this.invalidFirstNameVariable && !this.invalidLastNameVariable && !this.invalidDayVariable && !this.invalidMonthVariable && !this.invalidYearVariable) {
      let birthday: string = this.day + '/' + this.month + '/' + this.year;
      let gender: string;
      if (this.maleCheckBox == true)
        gender = 'male';
      else
        gender = 'female';
      this.patientPostWithSecureLogin = new PatientPostWithSecureLogin(this.firstName.toLowerCase(), this.lastName.toLowerCase(), this.adress.toLowerCase(), birthday, gender.toLowerCase(), this.patientGet.userId);
      this.updatePatientInfo();
    }
  }

  updatePatientInfo() {
    this.patientService.updatePatientInfoById(this.patientPostWithSecureLogin).subscribe(
      res => {
        this.getUserInfo();
        this.invalidMailVariable = false;
        this.generalInfo = 'show';
        this.toastr.success(this.translate.instant('infoUpdated'), this.translate.instant('update'), {
          timeOut: 5000,
          positionClass: 'toast-bottom-left'
        });
      },
      err => {
        this.toastr.warning(this.translate.instant('checkCnx'), this.translate.instant('cnx'), {
          timeOut: 3500,
          positionClass: 'toast-bottom-left'
        });
      }
    );
  }

  getUserInfo() {
    let token: any = jwt_decode(sessionStorage.getItem('auth-token'));
    this.patientService.getPatientInfo(parseInt(token.jti)).subscribe(
      res => {
        if (res) {
          this.patientGet = res;
          if (parseInt(this.patientGet.patientStatus) <= 99999 && parseInt(this.patientGet.patientStatus) >= 10000) {
            this.notVerified = true;
            this.lodadingAcountData = false;
          }
          else {
            this.openMessages(true);
            this.notVerified = false;
            this.headerService.setHeader('patient');
            this.getMyNotifications(this.patientGet.userId);
            this.getImage();
            this.getPatientMedicalProfile();
            this.getAppointments();
            this.getPrescriptionsByPatientIdAndPrescriptionStatus(this.patientGet.userId, '%', this.pendingPrescriptionPage, 'prescription');
            this.getMyDoctors(0);
            this.getMySecretaries(0);
            this.getMyPharmacies(0);
            this.intializeEdit();
            this.patientInfo = true;
            localStorage.setItem('id', this.patientGet.userId + '')
            this.lodadingAcountData = false;
          }
        } else
          this.router.navigate(['/acceuil']);
      },
      err => {
        this.toastr.info(this.translate.instant('checkCnx'), this.translate.instant('cnx'), {
          timeOut: 5000,
          positionClass: 'toast-bottom-left'
        });
      }
    );
  }

  getMyNotifications(userId: number) {
    this.notificationService.getAllNotificationByUserId(userId, this.notificationPage, 6).subscribe(
      res => {
        let notifications: NotificationGet[] = [];
        notifications = res;
        console.log(res);
        for (let notification of notifications) {
          notification.order = 'end';
          this.headerService.addNotification(notification);
        }
        if (notifications.length == 6)
          this.headerService.setLoadMoreNotification(true);
        else
          this.headerService.setLoadMoreNotification(false);
        this.notificationPage += 1;
      }
    );
  }

  checkLastName() {
    if (this.lastName.length < 3) {
      this.invalidLastNameVariable = true;
      this.lastNameInformation = this.translate.instant('firstSurname');
    } else {
      if (this.re.test(this.lastName)) {
        this.invalidLastNameVariable = false;
        this.lastNameInformation = this.translate.instant('surname');
      }
      else {
        this.invalidLastNameVariable = true;
        this.lastNameInformation = this.translate.instant('surnameApha');
      }
    }
  }

  checkFirstName() {
    if (this.firstName.length < 3) {
      this.invalidFirstNameVariable = true;
      this.firstNameInformation = this.translate.instant('nameFirst');
    } else {
      if (this.re.test(this.firstName)) {
        this.invalidFirstNameVariable = false;
        this.firstNameInformation = this.translate.instant('firstName');
      }
      else {
        this.invalidFirstNameVariable = true;
        this.firstNameInformation = this.translate.instant('nameApha');
      }
    }
  }

  updatePassword() {
    if (this.password.length > 5) {
      this.invalidPasswordVariable = false;
      this.passwordInfromation = this.translate.instant('password');
    }
    else {
      this.invalidPasswordVariable = true;
      this.passwordInfromation = this.translate.instant('passwordUnder6');
    }
    if (this.passwordRepeat == this.password || this.password.length < 6) {
      this.invalidPasswordRepeatVariable = false;
      this.passwordRepeatInfromation = this.translate.instant('repeatPassword');
    }
    else {
      this.invalidPasswordRepeatVariable = true;
      this.passwordRepeatInfromation = this.translate.instant('repeatPasswordErr');
    }
    if (!this.invalidPasswordVariable && !this.invalidPasswordRepeatVariable) {
      this.updatePasswordPost = new UpdatePasswordPost(this.patientGet.userId, this.passwordRepeat);
      this.userService.updateUserPasswordById(this.updatePasswordPost).subscribe(
        async res => {
          if (!res) {
            this.toastr.warning(this.translate.instant('applicationDataChanged'), this.translate.instant('Data'), {
              timeOut: 5000,
              positionClass: 'toast-bottom-left'
            });
            localStorage.setItem('id', '');
            await this.sleep(1000);
            document.getElementById("connexionSection").scrollIntoView({ behavior: "smooth" });
          } else {
            this.router.navigate(['/acceuil']);
            this.toastr.success(this.translate.instant('passwordChanged'), this.translate.instant('info'), {
              timeOut: 5000,
              positionClass: 'toast-bottom-left'
            });
            localStorage.setItem('id', '');
            await this.sleep(1);
            document.getElementById("connexionSection").scrollIntoView({ behavior: "smooth" });
          }
        },
        err => {
          this.toastr.warning(this.translate.instant('checkCnx'), this.translate.instant('cnx'), {
            timeOut: 5000,
            positionClass: 'toast-bottom-left'
          });
        }
      );
    }
  }

  sleep(ms) {
    return new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
  }

  intializeEdit() {
    this.firstName = this.patientGet.patientFirstName;
    this.lastName = this.patientGet.patientLastName;
    this.mail = this.patientGet.userUsername;
    this.adress = this.patientGet.userCity;
    this.day = this.patientGet.patientBirthDay.substr(0, 2);
    this.month = this.patientGet.patientBirthDay.substr(3, 2);
    this.year = this.patientGet.patientBirthDay.substr(6, 4);
    if (this.patientGet.patientGender == 'male')
      this.maleCheckBox = true;
    else
      this.femaleCheckBox = true;
  }

  initializeEditLabel() {
    this.firstNameInformation = this.translate.instant('firstName');
    this.passwordRepeatInfromation = this.translate.instant('repeatPassword');
    this.passwordInfromation = this.translate.instant('password');
    this.lastNameInformation = this.translate.instant('surname');
    this.mailInformation = this.translate.instant('mail');
    this.dayInformation = this.translate.instant('day');
    this.monthInformation = this.translate.instant('month');
    this.yearInformation = this.translate.instant('year');
    this.adressInformation = this.translate.instant('city');
    document.getElementById("generalInfoSection").scrollIntoView({ behavior: "smooth" });
  }

  checkAdress() {
    let lowerCaseAdress: string = this.adress.toLocaleLowerCase();
    this.adress = this.adress.replace('é', 'e');
    this.adress = this.adress.replace('è', 'e');
    for (let city of this.cities) {
      if (lowerCaseAdress == city.toLocaleLowerCase()) {
        this.invalidAdressVariable = false;
        this.adressInformation = this.translate.instant('city');
        break;
      }
      else {
        this.invalidAdressVariable = true;
        this.adressInformation = this.translate.instant('enterValidCity');
      }
    }
  }

  checkDisabledBtnFromMale() {
    if (this.patientGet.patientGender == 'female')
      this.disableSaveBtn = false;
    else
      this.disableSaveBtn = true;
  }

  checkDisabledBtnFromFemale() {
    if (this.patientGet.patientGender == 'male')
      this.disableSaveBtn = false;
    else
      this.disableSaveBtn = true;
  }

  checkBirthday() {
    if ((parseInt(this.day) <= 31 && parseInt(this.day) > 0) && (this.nb.test(this.day) && this.day.length == 2)) {
      this.invalidDayVariable = false;
      this.dayInformation = this.translate.instant('day');
    }
    else {
      this.invalidDayVariable = true;
      this.dayInformation = this.translate.instant('dayErr');
    }
    if ((parseInt(this.month) <= 12 && parseInt(this.month) > 0) && (this.nb.test(this.month) && this.month.length == 2)) {
      this.invalidMonthVariable = false;
      this.monthInformation = this.translate.instant('month');
    }
    else {
      this.invalidMonthVariable = true;
      this.monthInformation = this.translate.instant('monthErr');
    }
    if ((parseInt(this.year) <= 2021 && parseInt(this.year) > 1900) && (this.nb.test(this.year) && this.year.length == 4)) {
      this.invalidYearVariable = false;
      this.yearInformation = this.translate.instant('year');
    }
    else {
      this.invalidYearVariable = true;
      this.yearInformation = this.translate.instant('yearErr');
    }
  }

  changePasswordClick() {
    this.editeSecureInfo = true;
    this.editPassword = true;
    document.getElementById("generalInfoSection").scrollIntoView({ behavior: "smooth" });
  }

  changeUsernameClick() {
    this.editeSecureInfo = true;
    this.editPassword = false;
    document.getElementById("generalInfoSection").scrollIntoView({ behavior: "smooth" });
  }

  compareFirstName() {
    if (this.firstName.toLowerCase() === this.patientGet.patientFirstName)
      this.disableSaveBtn = true;
    else
      this.disableSaveBtn = false;
  }

  compareLastName() {
    if (this.lastName.toLowerCase() === this.patientGet.patientLastName)
      this.disableSaveBtn = true;
    else
      this.disableSaveBtn = false;
  }

  compareUserName() {
    if (this.mail.toLowerCase() === this.patientGet.userUsername)
      this.disableUpdateUsernamePassBtn = true;
    else
      this.disableUpdateUsernamePassBtn = false;
  }

  compareDay() {
    if (this.day === this.patientGet.patientBirthDay.substr(0, 2))
      this.disableSaveBtn = true;
    else
      this.disableSaveBtn = false;
  }

  compareMonth() {
    if (this.month === this.patientGet.patientBirthDay.substr(3, 2))
      this.disableSaveBtn = true;
    else
      this.disableSaveBtn = false;
  }

  compareYear() {
    if (this.year === this.patientGet.patientBirthDay.substr(6, 4))
      this.disableSaveBtn = true;
    else
      this.disableSaveBtn = false;
  }

  compareCity() {
    if (this.adress.toLowerCase() === this.patientGet.userCity)
      this.disableSaveBtn = true;
    else
      this.disableSaveBtn = false;
  }

  compareHeight() {
    if (parseFloat(this.height) == this.patientMedicalProfile.height || this.height == "")
      this.disableSaveMedicalProfileBtn = true;
    else
      this.disableSaveMedicalProfileBtn = false;
    this.height = this.height.replace(',', '.');

  }

  compareWeight() {
    if (parseFloat(this.weight) == this.patientMedicalProfile.weight || this.weight == "")
      this.disableSaveMedicalProfileBtn = true;
    else
      this.disableSaveMedicalProfileBtn = false;
    this.weight = this.weight.replace(',', '.');
  }

  initializeMedicalProfileLabel() {
    this.heightInformation = this.translate.instant('height');
    this.weightInformation = this.translate.instant('weight');
  }

  checkMedicalProfileForm() {
    if (parseFloat(this.height) > 0 && parseFloat(this.height) < 3 && this.er.test(this.height)) {
      if (this.height.length < 5) {
        this.invalidHeightVariable = false;
      } else {
        this.invalidHeightVariable = true;
        this.heightInformation = this.translate.instant('heightMax5');
      }
    } else {
      this.invalidHeightVariable = true;
      this.heightInformation = this.translate.instant('invalidHeight');
    }
    if (parseFloat(this.weight) > 0 && parseFloat(this.weight) < 500 && this.er.test(this.weight)) {
      if (this.weight.length < 6) {
        this.invalidWeightVariable = false;
      } else {
        this.invalidWeightVariable = true;
        this.weightInformation = this.translate.instant('weightMax6');
      }
    } else {
      this.invalidWeightVariable = true;
      this.weightInformation = this.translate.instant('invalidWeight');
    }
    this.weight = this.weight + '.';
    if (this.weight.match(/[.]/g).length > 2) {
      this.invalidWeightVariable = true;
      this.weightInformation = this.translate.instant('weightDot');
    }
    this.weight = this.weight.slice(0, -1);
    if (this.invalidWeightVariable == false && this.invalidHeightVariable == false)
      this.updateMedicalProfileData();
  }

  wait7Days: boolean = false;
  updateMedicalProfileData() {
    this.updateMedicalProfilePost = new UpdateMedicalProfilePost(this.patientGet.medicalProfileId, parseFloat(this.height), parseFloat(this.weight));
    this.patientService.updateMedicalProfileByMedicalProfileId(this.updateMedicalProfilePost).subscribe(
      res => {
        if (res == true) {
          this.medicalProfile = 'showData';
          this.toastr.success(this.translate.instant('infoUpdated'), this.translate.instant('update'), {
            timeOut: 5000,
            positionClass: 'toast-bottom-left'
          });
          this.getUserInfo();
          this.medicalProfileInfo = 'showData';
        } else {
          this.wait7Days = true;
        }
      }
    );
  }

  initilizeMedicalProfile() {
    this.height = this.patientMedicalProfile.height.toString();
    this.weight = this.patientMedicalProfile.weight.toString();
  }

  onFileChanged(event) {
    this.selectedFile = event.target.files[0];
    this.onUpload();
    this.getImage();
  }

  onUpload() {
    if (this.patientGet.userId == parseInt(localStorage.getItem('id'))) {
      const uploadImageData = new FormData();
      uploadImageData.append('imageFile', this.selectedFile, this.patientGet.userId + "profilePic");
      this.patientService.updatePatientProfilePhoto(uploadImageData).subscribe(
        res => {
          if (res == 'imageUpdated')
            this.getImage();
        },
        err => {
          this.toastr.warning(this.translate.instant('checkCnx'), this.translate.instant('cnx'), {
            timeOut: 5000,
            positionClass: 'toast-bottom-left'
          });
        }
      );
    } else {
      this.toastr.info(this.translate.instant('applicationDataChanged'), this.translate.instant('Data'), {
        timeOut: 5000,
        positionClass: 'toast-bottom-left'
      });
    }
  }

  getImage() {
    this.patientService.getPatientPofilePhoto(this.patientGet.userId).subscribe(
      res => {
        if (res != null) {
          this.retrieveResonse = res;
          this.base64Data = this.retrieveResonse.picByte;
          this.retrievedImage = 'data:image/jpeg;base64,' + this.base64Data;
        } else
          this.retrieveResonse = null;
      },
      err => {
        if (this.retrievedImage) {
          this.toastr.info(this.translate.instant('checkCnx'), this.translate.instant('cnx'), {
            timeOut: 5000,
            positionClass: 'toast-bottom-left'
          });
        }
      }
    );
  }

  getDocProfileImg(id: number, index: number, appLength) {
    let retrieveResonse: any;
    let base64Data: any;
    let retrievedImage: any;
    this.patientService.getDoctorPofilePhoto(id + 'profilePic').subscribe(
      res => {
        if (res != null) {
          retrieveResonse = res;
          base64Data = retrieveResonse.picByte;
          retrievedImage = 'data:image/jpeg;base64,' + base64Data;
          this.doctorProfileImg[index] = retrievedImage;
          if (appLength == ((index % 4) + 1)) {
            this.docProfileImages = true;
            if (this.docInfos && this.docProfileImages) {
              this.appointmentLoading = false;
            }
          }
        } else {
          this.doctorProfileImg[index] = false;
          this.docProfileImages = true;
        }
      }
    );

  }

  getDoctorAppointmentInfoForPatientByDoctorId(id: number, index: number, appLength) {
    this.doctorService.getDoctorAppointmentInfoForPatientByDoctorId(id).subscribe(
      res => {
        if (res) {
          this.docInfoForPatient[index] = res;
          if (appLength == ((index % 4) + 1)) {
            this.docInfos = true;
            if (this.docInfos && this.docProfileImages) {
              this.appointmentLoading = false;
            }
          }
        } else
          this.docInfos = true;
      }
    );

  }

  deleteAppById(id: number, key: number) {
    this.confirming = true;
    this.appointmentService.deleteAppointmentById(id).subscribe(
      res => {
        if (res) {
          this.toastr.success(this.translate.instant('appointmentDeleted'), this.translate.instant('appointment'), {
            timeOut: 5000,
            positionClass: 'toast-bottom-left'
          });
          this.deletedApp[key] = true;
        }
        this.confirming = false;
        this.closePopUp();
      },
      err => {
        this.toastr.warning(this.translate.instant('checkCnx'), this.translate.instant('cnx'), {
          timeOut: 5000,
          positionClass: 'toast-bottom-left'
        });
      }
    );
  }

  changeAppDate(docId: number, appDate: string, key: number) {
    this.generateMonthDay(docId, appDate, key);
    this.showUpdateCalendar[key] = true;
    document.getElementById("calendarGridSection").scrollIntoView({ behavior: "smooth" });
  }

  getMonthLastDay() {
    if (this.utcMonth == 1)
      this.lastMonthDay = 31;
    else if (this.utcMonth == 2) {
      if ((this.utcYear % 4) == 0)
        this.lastMonthDay = 29;
      else
        this.lastMonthDay = 28;
    } else if (this.utcMonth == 3)
      this.lastMonthDay = 31;
    else if (this.utcMonth == 4)
      this.lastMonthDay = 30;
    else if (this.utcMonth == 5)
      this.lastMonthDay = 31;
    else if (this.utcMonth == 6)
      this.lastMonthDay = 30;
    else if (this.utcMonth == 7)
      this.lastMonthDay = 31;
    else if (this.utcMonth == 8)
      this.lastMonthDay = 31;
    else if (this.utcMonth == 9)
      this.lastMonthDay = 30;
    else if (this.utcMonth == 10)
      this.lastMonthDay = 31;
    else if (this.utcMonth == 11)
      this.lastMonthDay = 30;
    else if (this.utcMonth == 12)
      this.lastMonthDay = 31;
  }

  generateMonthDay(docId: number, appDate: string, key: number) {
    this.daysName = [this.translate.instant('sun'), this.translate.instant('mon'), this.translate.instant('tue'), this.translate.instant('wed'), this.translate.instant('thu'), this.translate.instant('fri'), this.translate.instant('sat')];
    this.daysNameDouble = [this.translate.instant('sun'), this.translate.instant('mon'), this.translate.instant('tue'), this.translate.instant('wed'), this.translate.instant('thu'), this.translate.instant('fri'), this.translate.instant('sat'), this.translate.instant('sun'), this.translate.instant('mon'), this.translate.instant('tue'), this.translate.instant('wed'), this.translate.instant('thu'), this.translate.instant('fri'), this.translate.instant('sat'), this.translate.instant('sat')];
    this.getMonthLastDay();
    let day: number = 0;
    let todayNumber: number;
    this.todayName = /*'Sun';*/this.date.toString().slice(0, 3);
    let checkAppointmentMonth: number;
    let checkAppointmentYear: number;
    let appointmentDate: string;
    let integerAndStringPost: IntegerAndStringPost;
    let j1: number;
    let workDays: string;
    for (let c = 0; c < 7; c++) {
      if (this.daysNameEn[c] == this.todayName) {
        todayNumber = c;
        this.todayNumber = c;
      }
    }
    for (let c = 1; c <= 7; c++) {
      this.monthDays[day] = this.daysNameDouble[todayNumber];
      todayNumber++;
      day++;
    }
    for (var i = this.today; i <= this.lastMonthDay; i++) {
      this.monthDays[day] = i;
      if (this.appointmentDocInfoGet[key])
        workDays = this.appointmentDocInfoGet[key].workDays;
      else if (this.docInfoForPatient[key])
        workDays = this.docInfoForPatient[key].workDays;
      if (workDays.indexOf(this.daysNameEn[(this.todayNumber + i + (7 - this.todayNumber) + 1) % 7]) == -1)
        this.monthDaysDis[i] = true;
      else {
        if (i == this.today)
          this.monthDaysDis[this.today] = true;
        else {
          checkAppointmentMonth = this.utcMonth;
          checkAppointmentYear = this.utcYear;
          if (checkAppointmentMonth <= 9)
            appointmentDate = checkAppointmentYear + '/0' + checkAppointmentMonth + '/' + i;
          else
            appointmentDate = checkAppointmentYear + '/' + checkAppointmentMonth + '/' + i;
          integerAndStringPost = new IntegerAndStringPost(docId, appointmentDate);
          this.checkIfDayAppFull(i, integerAndStringPost, docId, appDate, key);
        }
      }
      day++;
    }
    for (var j = 0; j <= (this.today - this.lastMonthDay) + 26; j++) {
      this.monthDays[day + j] = j + 1;
      j1 = j + 1;
      if (workDays.indexOf(this.daysNameEn[(this.todayNumber + day + j) % 7]) == -1)
        this.monthDaysDis[j1] = true;
      else {
        checkAppointmentMonth = this.utcMonth + 1;
        checkAppointmentYear = this.utcYear;
        if (checkAppointmentMonth <= 9)
          appointmentDate = checkAppointmentYear + '/0' + checkAppointmentMonth + '/' + j1;
        else {
          if (checkAppointmentMonth == 13) {
            checkAppointmentMonth = 1;
            checkAppointmentYear = checkAppointmentYear + 1;
          }
          appointmentDate = checkAppointmentYear + '/' + checkAppointmentMonth + '/' + j1;
        }
        integerAndStringPost = new IntegerAndStringPost(docId, appointmentDate);
        this.checkIfDayAppFull(j1, integerAndStringPost, docId, appDate, key);
      }
    }
  }

  checkIfDayAppFull(i: number, integerAndStringPost: IntegerAndStringPost, docId: number, appDate: string, key: number) {
    let maxPatientPerDay: number;
    if (this.appointmentDocInfoGet[key])
      maxPatientPerDay = this.appointmentDocInfoGet[key].maxPatientPerDay;
    else if (this.docInfoForPatient[key])
      maxPatientPerDay = this.docInfoForPatient[key].maxPatientPerDay;
    if (i == parseInt(appDate.slice(8, 10)))
      this.monthDaysDis[i] = true;
    else {
      this.appointmentService.appointmentsCountByDoctorIdAndDate(integerAndStringPost).subscribe(
        res => {
          if (res >= maxPatientPerDay)
            this.monthDaysDis[i] = true;
          else
            this.monthDaysDis[i] = false;
        }
      );
    }
  }

  daySelected(day: number) {
    this.appointmentDay = day;
    if (day > 0 && day <= 31) {
      this.slectedDay = false;
      if (day >= this.today) {
        this.appointmentMonth = this.utcMonth;
        this.appointmentYear = this.utcYear;
      } else {
        if (this.utcMonth + 1 == 13) {
          this.appointmentMonth = 1;
          this.appointmentYear = this.utcYear + 1;
        } else {
          this.appointmentMonth = this.utcMonth + 1;
          this.appointmentYear = this.utcYear;
        }
      }
    }
    else
      this.slectedDay = true;
  }

  updateAppById(appId: number, key: number) {
    if (this.slectedDay == false) {
      if (this.appointmentMonth <= 9) {
        if (this.appointmentDay <= 9)
          this.appointmentDate = this.appointmentYear + '/0' + this.appointmentMonth + '/0' + this.appointmentDay;
        else
          this.appointmentDate = this.appointmentYear + '/0' + this.appointmentMonth + '/' + this.appointmentDay;
      } else {
        if (this.appointmentDay <= 9)
          this.appointmentDate = this.appointmentYear + '/' + this.appointmentMonth + '/0' + this.appointmentDay;
        else
          this.appointmentDate = this.appointmentYear + '/' + this.appointmentMonth + '/' + this.appointmentDay;
      }
      this.appointmentService.updateAppointmentDateById(appId, this.myAppointment[key].doctorId, this.patientGet.userId, this.appointmentDate).subscribe(
        res => {
          if (res == false) {
            this.toastr.success(this.translate.instant('appontmentDateUpdated'), this.translate.instant('appointment'), {
              timeOut: 5000,
              positionClass: 'toast-bottom-left'
            });
          } else
            this.myAppointment[key].appointmentStatus = 'changeDateRequest';
          this.showUpdateCalendar[key] = false;
          document.getElementById(key.toString()).scrollIntoView({ behavior: "smooth" });
          this.slectedDay = true;
          this.myAppointment[key].appointmentDate = this.appointmentDate;
        },
        err => {
          this.toastr.warning(this.translate.instant('checkCnx'), this.translate.instant('cnx'), {
            timeOut: 5000,
            positionClass: 'toast-bottom-left'
          });
        }
      );
    } else {
      this.toastr.warning(this.translate.instant('selectDayFirst'), this.translate.instant('appointment'), {
        timeOut: 5000,
        positionClass: 'toast-bottom-left'
      });
    }
  }

  getPatientMedicalProfile() {
    this.patientService.getPatientMedicalProfileByMedicalProfileId(this.patientGet.medicalProfileId).subscribe(
      res => {
        this.patientMedicalProfile = res;
        this.patientMedicalProfile.medicalProfileDisease = [];
        this.getPatientMedicalProfielDiseases(this.patientGet.medicalProfileId);
      }
    );
  }

  getAppointments() {
    this.docProfileImages = false;
    this.docInfos = false;
    this.appointmentLoading = true;
    let appointment: AppointmentGet[] = [];
    this.appointmentService.getPatientAppointmentByPatientId(this.patientGet.userId, this.appointmentPage, 4).subscribe(
      res => {
        appointment = res;
        for (let app of appointment) {
          this.deletedApp[this.myAppointment.length] = false;
          this.getDocProfileImg(app.doctorId, this.myAppointment.length, appointment.length);
          this.getDoctorAppointmentInfoForPatientByDoctorId(app.doctorId, this.myAppointment.length, appointment.length);
          this.myAppointment.push(app);
        }
        if (appointment.length == 4)
          this.showLoadMoreApp = true;
        else
          this.showLoadMoreApp = false;
        this.appointmentPage += 1;
      },
      err => {
        this.appointmentLoading = false;
      }
    );
  }

  getApproximationTime(startTime: string, approxTime: number, patientTurn: number): string {
    let time: number = approxTime * (patientTurn - 1);
    let startHour: number = 0; let endHour: number = 0;
    let docStartHour: number; let docStartMunite: number;
    if (startTime.length == 4) {
      docStartHour = parseInt(startTime.slice(0, 1));
      docStartMunite = parseInt(startTime.slice(2, 4));
    }
    else {
      docStartHour = parseInt(startTime.slice(0, 2));
      docStartMunite = parseInt(startTime.slice(3, 5));
    }

    time += docStartMunite;
    if (time >= 60) {
      endHour = 1;
      while (time >= 60) {
        time = time % 60;
        startHour += 1;
        endHour += 1;
      }
      time -= 30;
      if (((60 + time) % 60) <= 9)
        return (docStartHour + startHour) + 'h:0' + ((60 + time) % 60) + 'mn - ' + (docStartHour + endHour) + 'h:0' + ((60 + time) % 60) + 'mn';
      else
        return (docStartHour + startHour) + 'h:' + ((60 + time) % 60) + 'mn - ' + (docStartHour + endHour) + 'h:' + ((60 + time) % 60) + 'mn';
    } else {
      if ((docStartMunite + (approxTime * patientTurn) + 15) >= 60)
        endHour += 1;
      else
        endHour = 0;
      if (docStartMunite <= 9) {
        if (((docStartMunite + (approxTime * patientTurn) + 15) % 60) <= 9)
          return docStartHour + 'h:0' + docStartMunite + 'mn - ' + (docStartHour + endHour) + 'h:0' + ((docStartMunite + (approxTime * patientTurn) + 15) % 60) + 'mn';
        else
          return docStartHour + 'h:0' + docStartMunite + 'mn - ' + (docStartHour + endHour) + 'h:' + ((docStartMunite + (approxTime * patientTurn) + 15) % 60) + 'mn';
      }
      else {
        if (((docStartMunite + (approxTime * patientTurn) + 15) % 60) <= 9)
          return docStartHour + 'h:' + docStartMunite + 'mn - ' + (docStartHour + endHour) + 'h:0' + ((docStartMunite + (approxTime * patientTurn) + 15) % 60) + 'mn';
        else
          return docStartHour + 'h:' + docStartMunite + 'mn - ' + (docStartHour + endHour) + 'h:' + ((docStartMunite + (approxTime * patientTurn) + 15) % 60) + 'mn';
      }
    }
  }

  getPrescriptionsByPatientIdAndPrescriptionStatus(patientId: number, prescriptionStatus: string, page: number, status: string) {
    this.prescriptionService.getPrescriptionsByPatientIdAndPrescriptionStatus(patientId, prescriptionStatus, page, 3).subscribe(
      res => {
        let prescriptions: prescriptionGet[] = [];
        prescriptions = res;
        if (status == 'prescription') {
          for (let pres of prescriptions) {
            pres.fullData = false;
            this.prescriptions.push(pres);
            this.getPrescriptionMedicamentsByPrescriptionId(pres.prescriptionId, (this.prescriptions.length - 1), status)
          }
          if (prescriptions.length == 3)
            this.loadMorePrescription = true;
          else
            this.loadMorePrescription = false;
          this.pendingPrescriptionPage += 1;
        }
      }
    );
  }

  getPrescriptionMedicamentsByPrescriptionId(prescriptionId: number, presKey: number, status: string) {
    this.prescriptionService.getMedicamentsByPrescriptionId(prescriptionId).subscribe(
      res => {
        if (status == 'prescription')
          this.prescriptions[presKey].medicament = res;
        else if (status == 'disease')
          this.disPrescriptions[presKey].medicament = res;
      }
    );
  }

  getDoctorInfoForPresById(docId: number, patientKey: number, status: string) {
    this.doctorService.GetDoctorInfoById(docId).subscribe(
      res => {
        if (status == 'prescription') {
          this.presPresKey = patientKey;
          this.prescriptions[patientKey].prescriptiondoctor = res;
          this.prescription = 'prescription';
        }
        if (status == 'disease') {
          this.disPrescriptions[patientKey].prescriptiondoctor = res;
          this.showAllDisease = true;
          this.patientMedicalProfile.medicalProfileDisease[patientKey].showFullInfo = true;
        }
        this.getDocProfileImgForPres(docId, patientKey, status);
      }
    );
  }

  getDocProfileImgForPres(id: number, patientkey: number, status: string) {
    let retrieveResonse: any;
    let base64Data: any;
    let retrievedImage: any;
    this.patientService.getDoctorPofilePhoto(id + 'profilePic').subscribe(
      res => {
        if (res != null) {
          retrieveResonse = res;
          base64Data = retrieveResonse.picByte;
          retrievedImage = 'data:image/jpeg;base64,' + base64Data;
          if (status == 'prescription')
            this.prescriptions[patientkey].prescriptiondoctor.profileImg = retrievedImage;
          if (status == 'disease')
            this.disPrescriptions[patientkey].prescriptiondoctor.profileImg = retrievedImage;
        } else {
          if (status == 'prescription')
            this.prescriptions[patientkey].prescriptiondoctor.profileImg = false;
          if (status == 'disease')
            this.disPrescriptions[patientkey].prescriptiondoctor.profileImg = false;
        }
      }
    );
  }

  getPatientMedicalProfielDiseases(medicalProfileId: number) {
    this.patientService.getPatientMedicalProfileDeseasesByMedicalProfileId(medicalProfileId, this.diseasePage, 3).subscribe(
      res => {
        let response: medicalProfileDiseaseGet[];
        response = res;
        for (let dis of response) {
          dis.showFullInfo = false;
          this.loadDoctorInfoForMedicalProfileDis.push(false);
          this.patientMedicalProfile.medicalProfileDisease.push(dis);
        }
        if (response.length == 3)
          this.loadMoreDis = true;
        else
          this.loadMoreDis = false;
        this.diseasePage += 1;
      }
    );
  }

  getPrescriptionByDocIdPatientIdAndDate(docId: number, date: string, presKey: number, status: string) {
    this.prescriptionService.getPrescriptionByDoctorIdPatientIdAndDate(docId, this.patientGet.userId, date.slice(0, 10)).subscribe(
      res => {
        if (res) {
          this.presKey = presKey;
          this.disPrescriptions[presKey] = res;
          this.patientMedicalProfile.medicalProfileDisease[presKey].showFullInfo = false;
          this.getPrescriptionMedicamentsByPrescriptionId(this.disPrescriptions[presKey].prescriptionId, presKey, status);
          this.getDoctorInfoForPresById(this.disPrescriptions[presKey].doctorId, presKey, 'disease');
        } else {
          this.presKey = presKey;
          let pres: prescriptionGet;
          pres = { prescriptionId: 0, prescriptionDate: '', patientId: 0, doctorId: 0, medicament: null, fullData: false, prescriptiondoctor: null, prescriptionCode: 0, prescriptionStatus: 'pending' };
          this.disPrescriptions[presKey] = pres;
          this.getDoctorInfoForPresById(docId, presKey, 'disease');
        }
      }
    );
  }

  searchPharmaciesByMedicaments(firstTime: boolean) {
    this.loadingPh = true;
    if (!navigator.geolocation) {
      this.toastr.warning(this.translate.instant('deviceDontSupportGeoLocation'), this.translate.instant('position'), {
        timeOut: 3500,
        positionClass: 'toast-bottom-left'
      });
    } else {
      if ((firstTime && this.pharmacyPage == 0) || !firstTime) {
        let meds: string[] = this.prescriptions[this.presPresKey].medicament.map((meds) => meds.medicamentName);
        navigator.geolocation.getCurrentPosition((position) => {
          this.pharmacyService.searchPharmaciesByMedicaments(meds, /*position.coords.latitude*/environment.isimaLatitude, environment.isimaLongitude /*position.coords.longitude*/, 0, this.pharmacyPage, 4).subscribe(
            res => {
              let pharmacies: PharmacyGet[] = res;
              for (let pharmacy of pharmacies) {
                pharmacy.distance = pharmacy.distance.slice(0, (pharmacy.distance.indexOf('.') + 2));
                this.prescriptionPharmacies.push(pharmacy);
              }
              this.prescription = 'pharmacies';

              this.pharmacyPage += 1;

              if (pharmacies.length == 4)
                this.loadMorePharmacies = true;
              else
                this.loadMorePharmacies = false;
              this.loadingPh = false;
            }
          );
        });
      } else {
        this.prescription = 'pharmacies';
        this.loadingPh = false;
      }
    }
  }

  async openPharmacyMap(pharmacyKey: number) {
    this.prescription = 'map';
    this.pharmacyKey = pharmacyKey;

    let phMap = document.getElementById("pharmacyMap");

    while (!phMap) {
      await this.sleep(500);
      phMap = document.getElementById("pharmacyMap");
    }

    let pharmacyMap = L.map('pharmacyMap').setView([this.prescriptionPharmacies[pharmacyKey].pharmacyLatitude, this.prescriptionPharmacies[pharmacyKey].pharmacyLongitude], 13);

    L.tileLayer('https://api.mapbox.com/styles/v1/{id}/tiles/{z}/{x}/{y}?access_token=pk.eyJ1IjoibWVzc2FhZGlpIiwiYSI6ImNrbzA5eW96bDBkbHoybnFzeHVzajdoMDAifQ.d02E0EqNAcX4gKuNcPNsCQ', {
      attribution: 'Map data &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, Imagery © <a href="https://www.mapbox.com/">Mapbox</a>',
      maxZoom: 18,
      id: 'mapbox/streets-v11',
      tileSize: 512,
      zoomOffset: -1,
      accessToken: 'your.mapbox.access.token'
    }).addTo(pharmacyMap);

    let marker = L.marker([this.prescriptionPharmacies[pharmacyKey].pharmacyLatitude, this.prescriptionPharmacies[pharmacyKey].pharmacyLongitude]).addTo(pharmacyMap);
    marker.bindPopup(this.translate.instant('helloIm') + "<br><b>Ph. " + this.prescriptionPharmacies[pharmacyKey].pharmacyFullName.toLocaleUpperCase() + "</b>").openPopup();
    navigator.geolocation.getCurrentPosition((position) => {
      L.Routing.control({
        waypoints: [
          L.latLng(/*position.coords.latitude*/environment.isimaLatitude, environment.isimaLongitude /*position.coords.longitude*/),
          L.latLng(this.prescriptionPharmacies[pharmacyKey].pharmacyLatitude, this.prescriptionPharmacies[pharmacyKey].pharmacyLongitude)
        ]
      }).addTo(pharmacyMap);
    });
  }

  checkVerificationCode() {
    let code: number = parseInt(this.field1Code + this.field2Code + this.field3Code + this.field4Code + this.field5Code);
    if (code) {
      this.userService.checkVerifacationCode(this.patientGet.userUsername, code).subscribe(
        res => {
          if (res == true) {
            this.updateStatusByEmail();
          }
          else
            this.isVerificationCode = false;
        }, err => {
          this.toastr.warning(this.translate.instant('checkCnx'), this.translate.instant('cnx'), {
            timeOut: 3500,
            positionClass: 'toast-bottom-left'
          });
        }
      );
    } else {
      this.isVerificationCode = false;
    }
  }

  updateStatusByEmail() {
    this.userService.updateUserStatusByEmail(this.patientGet.userUsername, 'approved').subscribe(
      res => {
        if (res) {
          this.toastr.success(this.translate.instant('accountVerified'), this.translate.instant('verified'), {
            timeOut: 3500,
            positionClass: 'toast-bottom-left'
          });
          this.ngOnInit();
        }
      }
    );
  }

  openMessages(firstTime: boolean) {
    this.conversationService.getConversationByUserId(this.patientGet.userId, this.conversationPage, 10).subscribe(
      res => {
        let conversations: ConversationGet[] = res;
        for (let conver of conversations) {
          if (conver.message_content.length >= 10)
            conver.message_content = conver.message_content.slice(0, 7) + '...';
          if (conver.is_unread == true && conver.last_message_sender_id != this.patientGet.userId)
            this.newMessage += 1;
          let imageName: string;
          imageName = conver.recipient + 'profilePic';
          this.doctorService.getDoctorPofilePhoto(imageName).subscribe(
            res => {
              if (res != null) {
                let retrieveResonse: any = res;
                let base64Data: any = retrieveResonse.picByte;
                let retrievedImage: any = 'data:image/jpeg;base64,' + base64Data;
                conver.recipientImg = retrievedImage;
              } else
                conver.recipientImg = false;
            }
          );
          conver.order = 'end';
          this.headerService.addConversation(conver);
        }
        if (conversations.length == 10)
          this.headerService.setLoadMoreConversation(true);
        else
          this.headerService.setLoadMoreConversation(false);
        this.headerService.setParentHeader('message');
        this.conversationPage += 1;
        if (firstTime == false)
          this.headerService.showChildHeader(true);
      }
    );
  }

  openFullConversation(conver: OpenConversation) {
    if (!this.openConversation || this.openConversation.conversationId != conver.conversationId) {
      if (this.openConversation)
        this.restoreConversation();
      this.openConversation = conver;
      if (this.openConversation.isUnread == true)
        this.readConversation(this.openConversation.lastMessageSenderId);
      this.getConversationMessages(true);
      let i: number = 0;
      for (let conv of this.smallConversations) {
        if (conv.conversationId == this.openConversation.conversationId) {
          this.smallConversations.splice(i, 1);
          break;
        }
        i = +1;
      }
    }
  }

  getConversationMessages(firstTime: boolean) {
    this.loadingMessages = true;
    this.conversationService.getMessagesByConversationId(this.openConversation.conversationId, this.openConversation.messagePage, 20).subscribe(
      async res => {
        console.log(res)
        let messages: MessageGet[] = res;
        for (let message of messages)
          this.openConversation.messages.unshift(message);
        if (firstTime) {
          await this.sleep(1);
          this.messagesContainer.nativeElement.scrollTop = this.messagesContainer.nativeElement.scrollHeight;
        }
        else {
          await this.sleep(1);
          this.messagesContainer.nativeElement.scroll({
            top: document.getElementById("message" + messages.length).getBoundingClientRect().top - document.getElementById("messagesContainer").getBoundingClientRect().top,
            left: 0
          });
        }
        if (messages.length == 20)
          this.openConversation.loadMoreMessage = true;
        else
          this.openConversation.loadMoreMessage = false;

        this.openConversation.messagePage += 1;
        this.loadingMessages = false;
      }
    );
  }

  @HostListener('scroll', ['$event'])
  messagesScroll(event) {
    if (document.getElementById("messagesContainer").scrollTop < 10 && this.openConversation.loadMoreMessage == true && this.loadingMessages == false) {
      this.openConversation.loadMoreMessage = false;
      this.getConversationMessages(false);
    }
  }

  sendMessage() {
    if (this.message && this.message.length != 0) {
      this.conversationService.sendMessage(this.patientGet.userId, this.openConversation.userId, this.message, this.openConversation.conversationId).subscribe(
        async res => {
          let response: StringGet = res;
          if (response.string.length != 0) {
            let message: MessageGet = { messageContent: this.message, senderId: this.patientGet.userId, recipientId: this.openConversation.userId, messageDate: response.string, conversationId: this.openConversation.conversationId }
            this.openConversation.messages.push(message);
            this.headerService.newMessage(message);
            this.message = '';
            await this.sleep(1);
            this.scrollToBottomMessages();
            this.headerService.setFirstConversation(this.openConversation.conversationId);
            this.openConversation.isUnread = true;
            let data: IdAndBoolean = { id: this.openConversation.conversationId, boolean: true, lastMessageSenderId: this.patientGet.userId };
            this.headerService.setReadConversation(data);
            this.openConversation.lastMessageSenderId = this.patientGet.userId;
          }
        }
      );
    }
  }

  scrollToBottomMessages(): void {
    this.messagesContainer.nativeElement.scroll({
      top: this.messagesContainer.nativeElement.scrollHeight,
      left: 0,
      behavior: 'smooth'
    });
  }

  messageSound() {
    let audio = new Audio();
    audio.src = "../../../../assets/sounds/messageSound.wav";
    audio.load();
    audio.play();
  }

  notificationSound() {
    let audio = new Audio();
    audio.src = "../../../../assets/sounds/notificationSound.wav";
    audio.load();
    audio.play();
  }

  readConversation(lastSenderId: number) {
    if (this.openConversation.isUnread == true && lastSenderId != this.patientGet.userId) {
      this.conversationService.readConversationById(this.openConversation.conversationId, this.openConversation.userId).subscribe(
        res => {
          if (res) {
            this.openConversation.isUnread = false;
            this.newMessage -= 1;
            let data: IdAndBoolean = { id: this.openConversation.conversationId, boolean: false, lastMessageSenderId: 0 };
            this.headerService.setReadConversation(data);
          }
        }
      );
    }
  }

  startConversation(recipientId: number, firstName: string, lastName: string) {
    this.conversationService.addConversation(this.patientGet.userId, recipientId).subscribe(
      res => {
        let conversation: Conversation = res;
        let conv: ConversationGet = {
          recipient: recipientId,
          open_date: conversation.openDate,
          last_name: lastName,
          conversation_id: conversation.conversationId,
          last_update_date: conversation.openDate,
          first_name: firstName,
          conversation_status: conversation.conversationStatus,
          recipientImg: false,
          user_type: '',
          message_content: conversation.messageContent,
          order: 'start',
          is_unread: false,
          last_message_sender_id: 0,
          status_updated_by: conversation.statusUpdatedBy
        }
        let retrieveResonse: any;
        let base64Data: any;
        let retrievedImage: any;
        this.doctorService.getDoctorPofilePhoto(recipientId + 'profilePic').subscribe(
          res => {
            if (res != null) {
              retrieveResonse = res;
              base64Data = retrieveResonse.picByte;
              retrievedImage = 'data:image/jpeg;base64,' + base64Data;
              conv.recipientImg = retrievedImage;
            }
          }
        );
        this.headerService.addConversation(conv);
        this.headerService.setParentHeader('message');

        let openConver: OpenConversation = {
          conversationId: conv.conversation_id,
          username: firstName + ' ' + lastName.toUpperCase(),
          messagePage: 0,
          messages: [],
          userId: conv.recipient,
          userImg: conv.recipientImg,
          isUnread: conv.is_unread,
          lastMessageSenderId: conv.last_message_sender_id,
          conversationStatus: conv.conversation_status,
          loadMoreMessage: true,
          statusUpdatedBy: conv.status_updated_by
        };
        this.openFullConversation(openConver);
      }
    );
  }

  async showFullconv(convKey: number) {
    this.openConversation = this.smallConversations[convKey];
    this.smallConversations.splice(convKey, 1);
    await this.sleep(1);
    this.messagesContainer.nativeElement.scrollTop = this.messagesContainer.nativeElement.scrollHeight;
    if (this.openConversation.isUnread == true)
      this.readConversation(this.openConversation.lastMessageSenderId);
  }

  restoreConversation() {
    let convFound: boolean = false;
    let i: number = 0;
    for (let conv of this.smallConversations) {
      if (conv.conversationId == this.openConversation.conversationId) {
        convFound = true;
        break;
      }
      i += 1;
    }
    if (convFound == false) {
      if (this.smallConversations.length == 3)
        this.smallConversations.splice(0, 1);
      this.smallConversations.push(this.openConversation);
    } else {
      let newOrdConv: OpenConversation = this.smallConversations[i];
      this.smallConversations.splice(i, 1);
      this.smallConversations.push(newOrdConv);
    }
    this.openConversation = null;
  }

  closeSmallConv(convKey: number) {
    this.smallConversations.splice(convKey, 1);
    if (this.smallConversations[convKey].conversationId == this.openConversation.conversationId)
      this.openConversation = null;
  }

  sentOpenConversationRequest(recipientId: number, conversationid: number) {
    this.notificationService.sendNotificationWithSocket(this.patientGet.userId, recipientId, conversationid + "", "openConversationRequest", false).subscribe(
      res => {
        if (res == 0) {
          this.toastr.success(this.translate.instant('requestSnet'), this.translate.instant('notification'), {
            timeOut: 3500,
            positionClass: 'toast-bottom-left'
          });
        }
      },
      err => {
        this.toastr.warning(this.translate.instant('checkCnx'), this.translate.instant('cnx'), {
          timeOut: 3500,
          positionClass: 'toast-bottom-left'
        });
      }
    );
  }

  findMoreUser() {
    this.headerService.searchUserNow(true);
  }

  showUserFullInfo(userKey: number) {
    this.selectedUser = this.searchedUsers[userKey];
    if (this.searchedUsers[userKey].userType == 'doctor' || this.searchedUsers[userKey].userType == 'pharmacist')
      this.setSelectedUserPosition();
    else {
      this.selectedUser.patientQuestionsPage = 0;
      this.selectedUser.patientQuestions = [];
      this.getPatientQuestionsById(this.selectedUser.userId, this.selectedUser.patientQuestionsPage);
    }
    window.scroll({
      top: 0,
      left: 0,
      behavior: 'smooth'
    });
  }

  async setSelectedUserPosition() {
    if (this.selectedUser.userLatitude.length != 0 && this.selectedUser.userLongitude.length != 0) {
      let container = document.getElementById('selectedUserMap');
      while (!container) {
        container = document.getElementById('selectedUserMap');
        await this.sleep(500);
      }
      this.myMap = L.map('selectedUserMap').setView([this.selectedUser.userLatitude, this.selectedUser.userLongitude], 13);

      L.tileLayer('https://api.mapbox.com/styles/v1/{id}/tiles/{z}/{x}/{y}?access_token=pk.eyJ1IjoibWVzc2FhZGlpIiwiYSI6ImNrbzE3ZHZwbzA1djEyb3M1bzY4cmw1ejYifQ.cisRE8KJri7O9GD3KkMCCg', {
        attribution: 'Map data &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, Imagery © <a href="https://www.mapbox.com/">Mapbox</a>',
        maxZoom: 18,
        id: 'mapbox/streets-v11',
        tileSize: 512,
        zoomOffset: -1,
        accessToken: 'your.mapbox.access.token'
      }).addTo(this.myMap);

      let marker = L.marker([this.selectedUser.userLatitude, this.selectedUser.userLongitude]).addTo(this.myMap);
      marker.bindPopup(this.translate.instant('helloIm') + "<br><b> " + this.selectedUser.userFullName + "</b>").openPopup();
    }
  }

  addMapRoute() {
    navigator.geolocation.getCurrentPosition((position) => {
      L.Routing.control({
        waypoints: [
          L.latLng(/*position.coords.latitude*/environment.isimaLatitude, environment.isimaLongitude /*position.coords.longitude*/),
          L.latLng(this.selectedUser.userLatitude, this.selectedUser.userLongitude)
        ]
      }).addTo(this.myMap);
    });
  }

  getPatientQuestionsById(userId: number, pageNumber: number) {
    this.questionService.getQuestionsByUserId(userId, pageNumber, 4).subscribe(
      res => {
        let questions: QuestionGet[] = res;
        for (let ques of questions) {
          this.selectedUser.patientQuestions.push(ques);
        }
        if (questions.length == 4)
          this.selectedUser.loadMoreQuestion = true;
        else
          this.selectedUser.loadMoreQuestion = false;
        this.selectedUser.patientQuestionsPage += 1;
      }
    );
  }

  isDatePassed(date: string): boolean {
    let today: string = formatDate(new Date(), 'yyyy/MM/dd', 'en');
    if (parseInt(date.slice(0, 4)) > parseInt(today.slice(0, 4)))
      return false;
    else if (parseInt(date.slice(0, 4)) < parseInt(today.slice(0, 4)))
      return true;
    else {
      if (parseInt(date.slice(5, 7)) > parseInt(today.slice(5, 7)))
        return false;
      else if (parseInt(date.slice(5, 7)) < parseInt(today.slice(5, 7)))
        return true;
      else {
        if (parseInt(date.slice(8, 10)) > parseInt(today.slice(8, 10)))
          return false;
        else if (parseInt(date.slice(8, 10)) < parseInt(today.slice(8, 10)))
          return true;
        else {
          return null;
        }
      }
    }
  }

  selectPharmacy(force: boolean) {
    this.confirming = true;
    this.notificationService.sendNotificationWithSocket(this.patientGet.userId, this.prescriptionPharmacies[this.pharmacyKey].userId, this.prescriptions[this.presPresKey].prescriptionId + "", "userSelectYouForPres", force).subscribe(
      res => {
        if (res == 0) {
          this.toastr.success(this.translate.instant('nowYouCanVisitIt'), this.translate.instant('pharmacySelected'), {
            timeOut: 6500,
            positionClass: 'toast-bottom-left'
          });
          this.prescription = 'all';
        } else {
          if (res == -1) {
            this.toastr.warning(this.translate.instant('youAlreadySelectPh') + this.prescriptionPharmacies[this.pharmacyKey].pharmacyFullName.toLocaleUpperCase() + ' ' + this.translate.instant('forThisPres'), this.translate.instant('pharmacyAlreadySelected'), {
              timeOut: 6500,
              positionClass: 'toast-bottom-left'
            });
          } else {
            this.pharmacyService.getPharmacyInfoById(res).subscribe(
              res => {
                let pharmacy: PharmacyGet = res;
                this.openPopUp('confirmChangeSelectedPharmacy', pharmacy.pharmacyFullName, '');
              },
              err => {
                this.toastr.warning(this.translate.instant('checkCnx'), this.translate.instant('cnx'), {
                  timeOut: 3500,
                  positionClass: 'toast-bottom-left'
                });
              }
            );
          }
        }
        this.confirming = false;
        if (force == true)
          this.closePopUp();
      },
      err => {
        this.toastr.warning(this.translate.instant('checkCnx'), this.translate.instant('cnx'), {
          timeOut: 3500,
          positionClass: 'toast-bottom-left'
        });
      }
    );
  }

  closePopUp() {
    this.popUp = false;
    this.popUpTitle = '';
    this.popUpText = '';
    this.popUpFor = '';
    this.popUpValue1 = '';
    this.popUpValue2 = '';
  }

  openPopUp(popUpFor: string, value1: string, value2: string) {
    this.popUpFor = popUpFor;
    this.popUpValue1 = value1;
    this.popUpValue2 = value2;
    if (popUpFor == 'confirmChangeSelectedPharmacy') {
      this.popUpTitle = this.translate.instant('confirmChanging');
      this.popUpText = this.translate.instant('thisPresIsAlready') + ' ' + value1.toLocaleUpperCase() + ', ' + this.translate.instant('ifYouWantToChangePh') + value1.toLocaleUpperCase() + ', ' + this.translate.instant('doYouWantToCinfirm') + '?';
    } else if (popUpFor == 'deleteAppoitment') {
      this.popUpTitle = this.translate.instant('confirmDelete');
      this.popUpText = this.translate.instant('confirmDeletingThisAppointment') + ' ' + this.docInfoForPatient[parseInt(value2)].doctorFirstName.toLocaleUpperCase() + ' ' + this.docInfoForPatient[parseInt(value2)].doctorLastName.toLocaleUpperCase() + ' ' + this.translate.instant('on').toLocaleLowerCase() + ' ' + this.myAppointment[parseInt(value2)].appointmentDate + ', ' + this.translate.instant('thisActionIsIree') + ', ' + this.translate.instant('confirmAnyWay') + '?';
    }
    this.popUp = true;
  }

  confirmPopUp() {
    if (this.popUpFor == 'confirmChangeSelectedPharmacy')
      this.selectPharmacy(true);
    else if (this.popUpFor == 'deleteAppoitment')
      this.deleteAppById(parseInt(this.popUpValue1), parseInt(this.popUpValue2));
  }

  getAppointmentById(appId: number) {
    this.appointmentService.getAppointmentById(appId).subscribe(
      res => {
        this.myAppointment.unshift(res);
      }
    );
  }

  async getImageByName(imageName: string): Promise<any> {
    let res: any = await this.doctorService.getDoctorPofilePhoto(imageName).toPromise();
    if (res != null) {
      let retrieveResonse: any = res;
      let base64Data: any = retrieveResonse.picByte;
      return 'data:image/jpeg;base64,' + base64Data;
    } else
      return false;
  }

  myDoctorsPage: number = 0;
  myDoctors: MyUserWithPag = { list: [], count: 0 };
  myDoctorsPages: number[] = [];
  loadingDoctors: boolean;
  getMyDoctors(page: number) {
    this.loadingDoctors = true;
    this.patientService.getMyDoctors(this.patientGet.userId, page, 4).subscribe(
      res => {
        let myDoctors: MyUserWithPag = res;
        this.myDoctors.count = Math.ceil(myDoctors.count / 4);
        if (this.myDoctorsPage == 0) {
          let myDoctorsPages: number[] = [];
          for (let i = 1; i <= this.myDoctors.count; i++)
            myDoctorsPages.push(i);
          this.myDoctorsPages = myDoctorsPages;
        }
        for (let doc of myDoctors.list) {
          this.getImageByName(doc.userId + 'profilePic').then((vlaue) => { doc.profileImg = vlaue; });
          doc.rated = false;
          this.myDoctors.list.push(doc);
        }
        this.myDoctorsPage = page;
        this.loadingDoctors = false;
      },
      err => {
        this.loadingDoctors = false;
      }
    );
  }

  mySecretariesPage: number = 0;
  mySecretaries: MyUserWithPag = { list: [], count: 0 };
  mySecretariesPages: number[] = [];
  loadingSecretaries: boolean;
  getMySecretaries(page: number) {
    this.loadingSecretaries = true;
    this.patientService.getMySecretaries(this.patientGet.userId, page, 4).subscribe(
      res => {
        let mySecretaries: MyUserWithPag = res;
        this.mySecretaries.count = Math.ceil(mySecretaries.count / 4);
        if (this.mySecretariesPage == 0) {
          let mySecretariesPages: number[] = [];
          for (let i = 1; i <= this.mySecretaries.count; i++)
            mySecretariesPages.push(i);
          this.mySecretariesPages = mySecretariesPages;
        }
        for (let sec of mySecretaries.list) {
          this.getImageByName(sec.userId + 'profilePic').then((vlaue) => { sec.profileImg = vlaue; });
          sec.rated = false;
          this.mySecretaries.list.push(sec);
        }
        this.mySecretariesPage = page;
        this.loadingSecretaries = false;
      },
      err => {
        this.loadingSecretaries = false;
      }
    );
  }

  myPharmaciesPage: number = 0;
  myPharmacies: MyUserWithPag = { list: [], count: 0 };
  myPharmaciesPages: number[] = [];
  loadingPharmacies: boolean;
  getMyPharmacies(page: number) {
    this.loadingPharmacies = true;
    this.patientService.getMyPharmacies(this.patientGet.userId, page, 4).subscribe(
      res => {
        let myPharmacies: MyUserWithPag = res;
        this.myPharmacies.count = Math.ceil(myPharmacies.count / 4);
        if (this.myPharmaciesPage == 0) {
          let myPharmaciesPages: number[] = [];
          for (let i = 1; i <= this.myPharmacies.count; i++)
            myPharmaciesPages.push(i);
          this.myPharmaciesPages = myPharmaciesPages;
        }
        for (let sec of myPharmacies.list) {
          this.getImageByName(sec.userId + 'profilePic').then((vlaue) => { sec.profileImg = vlaue; });
          sec.rated = false;
          this.myPharmacies.list.push(sec);
        }
        this.myPharmaciesPage = page;
        this.loadingPharmacies = false;
      },
      err => {
        this.loadingPharmacies = false;
      }
    );
  }

  addRate(key: number, userType: string) {
    let userId: number;
    let rate: number;
    if (userType == 'doctor') {
      userId = this.myDoctors.list[key].userId;
      rate = this.myDoctors.list[key].rate;
    } else if (userType == 'secretary') {
      userId = this.mySecretaries.list[key].userId;
      rate = this.mySecretaries.list[key].rate;
    } else if (userType == 'pharmacy') {
      userId = this.myPharmacies.list[key].userId;
      rate = this.myPharmacies.list[key].rate;
    }
    this.rateService.addRate(this.patientGet.userId, userId, rate).subscribe(
      res => {
        if (userType == 'doctor') {
          this.myDoctors.list[key].rate = rate;
          this.myDoctors.list[key].rated = false;
          this.myDoctors.list[key].userRate = res;
        } else if (userType == 'secretary') {
          this.mySecretaries.list[key].rate = rate;
          this.mySecretaries.list[key].rated = false;
          this.mySecretaries.list[key].userRate = res;
        }
        else if (userType == 'pharmacy') {
          this.myPharmacies.list[key].rate = rate;
          this.myPharmacies.list[key].rated = false;
          this.myPharmacies.list[key].userRate = res;
        }
      }, err => {
        this.toastr.warning(this.translate.instant('checkCnx'), this.translate.instant('cnx'), {
          timeOut: 3500,
          positionClass: 'toast-bottom-left'
        });
      }
    );
  }

  heightValues: boolean = false;
  heightChartWidth: number;
  getHeightValues() {
    if (this.heightValues == false) {
      this.patientService.getHeightValues(this.patientGet.userId).subscribe(
        res => {
          let labels: any[] = [];
          let dataCases: any[] = [];
          let heightValues: HeightValues[] = res;
          for (let height of heightValues) {
            if (height.time.length != 0)
              labels.push(height.time.slice(2, 10));
            else
              labels.push(this.translate.instant('now'));
            dataCases.push(height.height);
          }
          this.heightChartWidth = 50 * labels.length;
          this.chartjs(labels, dataCases, 'heightChart');
        }
      );
    } else {
      this.heightValues = false;
      document.getElementById("heightSection").scrollIntoView({ behavior: 'smooth' });
    }
  }

  weightValues: boolean = false;
  weightChartWidth: number;
  getWeightValues() {
    if (this.weightValues == false) {
      this.patientService.getWeightValues(this.patientGet.userId).subscribe(
        res => {
          let labels: any[] = [];
          let dataCases: any[] = [];
          let weightValues: WeightValues[] = res;
          for (let weight of weightValues) {
            if (weight.time.length != 0)
              labels.push(weight.time.slice(2, 10));
            else
              labels.push(this.translate.instant('now'));
            dataCases.push(weight.weight);
          }
          this.weightChartWidth = 50 * labels.length;
          this.chartjs(labels, dataCases, 'weightChart');
        }
      );
    } else {
      this.weightValues = false;
      document.getElementById("weightSection").scrollIntoView({ behavior: 'smooth' });
    }
  }

  chartjs(labels, dataCases, chartId) {
    let canvas: any = document.getElementById(chartId);
    let ctx: any = canvas.getContext('2d');

    let chart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [{
          data: dataCases,
          backgroundColor: '#08a0f6',
          borderColor: '#08a0f6',
          fill: false,
          borderWidth: 2
        }]
      }, options: {
        maintainAspectRatio: false,
        title: {
          display: false,
        },
        tooltips: {
          mode: 'index',
          intersect: false
        },
        hover: {
          mode: 'nearest',
          intersect: false
        },
        legend: {
          display: false
        }
      }
    });
    if (chartId == 'heightChart') {
      this.heightValues = true;
      document.getElementById("heightSection").scrollIntoView({ behavior: 'smooth' });
    } else if (chartId == 'weightChart') {
      this.weightValues = true;
      document.getElementById("weightSection").scrollIntoView({ behavior: 'smooth' });
    }
  }
}
