<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\BillingController;
use App\Http\Controllers\Api\DefectReportController;
use App\Http\Controllers\Api\EmergencyAccessController;
use App\Http\Controllers\Api\HospitalController;
use App\Http\Controllers\Api\StaffingController;
use App\Http\Controllers\Api\SurgicalRequisitionController;
use Illuminate\Support\Facades\Route;

Route::post('/login', [AuthController::class, 'login'])->middleware('throttle:10,1');

Route::middleware('auth:sanctum')->group(function (): void {
    Route::get('/user', [AuthController::class, 'me']);
    Route::post('/logout', [AuthController::class, 'logout']);
    Route::get('/bootstrap', [HospitalController::class, 'bootstrap']);
    Route::get('/patients/{id}/record', [EmergencyAccessController::class, 'patientRecord']);
    Route::post('/patients/{id}/medical-discharge', [HospitalController::class, 'medicalDischarge'])
        ->middleware('role:medico_general,especialista');
    Route::post('/patients/{id}/request-discharge', [HospitalController::class, 'requestDischarge'])
        ->middleware('role:admin');
    Route::post('/patients/{id}/administrative-discharge', [HospitalController::class, 'administrativeDischarge'])
        ->middleware('role:admin');
    Route::get('/security/code-red', [EmergencyAccessController::class, 'control']);
    Route::get('/security/patients', [EmergencyAccessController::class, 'patientChoices'])
        ->middleware('role:admin,recepcion,medico_general,especialista,farmacia,nutricion,enfermeria,cirugia');
    Route::put('/security/code-red', [EmergencyAccessController::class, 'setControl'])->middleware('role:admin');
    Route::post('/security/emergency-access', [EmergencyAccessController::class, 'requestAccess'])
        ->middleware('role:medico_general,especialista');
    Route::get('/security/emergency-access', [EmergencyAccessController::class, 'grants'])->middleware('role:admin');
    Route::get('/security/temporary-roles', [EmergencyAccessController::class, 'temporaryRoleGrants'])->middleware('role:admin');
    Route::post('/security/temporary-roles', [EmergencyAccessController::class, 'storeTemporaryRoleGrant'])->middleware('role:admin');
    Route::delete('/security/temporary-roles/{id}', [EmergencyAccessController::class, 'revokeTemporaryRoleGrant'])->middleware('role:admin');

    Route::get('/patients', [HospitalController::class, 'patients'])->middleware('role:admin,recepcion,medico_general,especialista,farmacia,nutricion,enfermeria,cirugia');
    Route::post('/patients', [HospitalController::class, 'storePatient'])->middleware('role:admin,recepcion');
    Route::put('/patients/{id}', [HospitalController::class, 'updatePatient'])
        ->middleware('role:admin,recepcion,medico_general,especialista,enfermeria');
    Route::patch('/patients/{id}/status', [HospitalController::class, 'updatePatientStatus'])->middleware('role:admin,recepcion,medico_general,especialista');

    Route::get('/doctors', [HospitalController::class, 'doctors'])->middleware('role:admin,recepcion,medico_general,especialista');
    Route::get('/doctor-accounts', [HospitalController::class, 'doctorAccounts'])->middleware('role:admin');
    Route::get('/nurse-accounts', [HospitalController::class, 'nurseAccounts'])->middleware('role:admin');
    Route::post('/doctors', [HospitalController::class, 'storeDoctor'])->middleware('role:admin');
    Route::put('/doctors/{id}', [HospitalController::class, 'updateDoctor'])->middleware('role:admin,recepcion');
    Route::patch('/doctors/{id}/status', [HospitalController::class, 'updateDoctorStatus'])->middleware('role:admin');

    Route::get('/rooms', [HospitalController::class, 'rooms'])->middleware('role:admin,recepcion,medico_general,especialista');
    Route::post('/rooms', [HospitalController::class, 'storeRoom'])->middleware('role:admin');
    Route::put('/rooms/{id}', [HospitalController::class, 'updateRoom'])->middleware('role:admin');
    Route::get('/area-staff', [HospitalController::class, 'areaStaff'])
        ->middleware('role:admin,farmacia,almacen,nutricion,compras,medico_general,especialista');
    Route::put('/area-staff', [HospitalController::class, 'updateAreaStaff'])->middleware('role:admin');
    Route::patch('/rooms/{id}/status', [HospitalController::class, 'updateRoomStatus'])->middleware('role:admin');
    Route::get('/room-reservations', [HospitalController::class, 'roomReservations'])->middleware('role:admin,recepcion,medico_general,especialista');
    Route::post('/room-reservations', [HospitalController::class, 'storeRoomReservation'])->middleware('role:admin,recepcion');
    Route::patch('/room-reservations/{id}/cancel', [HospitalController::class, 'cancelRoomReservation'])->middleware('role:admin,recepcion');
    Route::get('/room-audit', [HospitalController::class, 'roomAudit'])->middleware('role:admin');

    Route::get('/schedules', [HospitalController::class, 'schedules'])->middleware('role:admin,recepcion,medico_general,especialista');
    Route::post('/schedules', [HospitalController::class, 'storeSchedule'])->middleware('role:admin');
    Route::patch('/schedules/{id}', [HospitalController::class, 'updateSchedule'])->middleware('role:admin');
    Route::get('/doctor-assignments', [HospitalController::class, 'doctorAssignments'])
        ->middleware('role:admin,recepcion,medico_general,especialista,cirugia');
    Route::post('/doctor-assignments', [HospitalController::class, 'storeDoctorAssignment'])
        ->middleware('role:admin');
    Route::post('/doctor-assignments/rotate-demand', [HospitalController::class, 'rotateDoctorAssignments'])
        ->middleware('role:admin');
    Route::get('/doctor-assignments/demand-metrics', [HospitalController::class, 'assignmentDemandMetrics'])
        ->middleware('role:admin,recepcion');
    Route::get('/availability', [HospitalController::class, 'availability']);
    Route::get('/appointment-suggestions', [HospitalController::class, 'appointmentSuggestions']);
    Route::get('/staff-absences', [StaffingController::class, 'absences'])->middleware('role:admin,recepcion');
    Route::post('/staff-absences', [StaffingController::class, 'storeAbsence'])->middleware('role:admin,recepcion');
    Route::get('/replacement-candidates', [StaffingController::class, 'replacementCandidates'])->middleware('role:admin,recepcion');

    Route::get('/appointments', [HospitalController::class, 'appointments'])->middleware('role:admin,recepcion,medico_general,especialista');
    Route::post('/appointments', [HospitalController::class, 'storeAppointment'])->middleware('role:admin,recepcion');
    Route::put('/appointments/{id}', [HospitalController::class, 'updateAppointment'])->middleware('role:admin,recepcion');
    Route::patch('/appointments/{id}/status', [HospitalController::class, 'updateAppointmentStatus'])->middleware('role:admin,recepcion');
    Route::post('/appointments/{id}/attend', [HospitalController::class, 'attendAppointment'])->middleware('role:medico_general,especialista');
    Route::get('/doctor-history', [HospitalController::class, 'doctorHistory'])->middleware('role:admin');

    Route::get('/consultations', [HospitalController::class, 'consultations'])->middleware('role:medico_general,especialista,nutricion,cirugia');
    Route::post('/consultations', [HospitalController::class, 'storeConsultation'])->middleware('role:medico_general,especialista');
    Route::patch('/consultations/{id}', [HospitalController::class, 'updateConsultation'])->middleware('role:medico_general,especialista,nutricion,cirugia');
    Route::post('/consultations/{id}/addenda', [HospitalController::class, 'addConsultationAddendum'])
        ->middleware('role:medico_general,especialista');

    Route::get('/operations', [HospitalController::class, 'operations'])->middleware('role:especialista,cirugia');
    Route::post('/operations', [HospitalController::class, 'storeOperation'])->middleware('role:especialista,cirugia');
    Route::patch('/operations/{id}', [HospitalController::class, 'updateOperation'])->middleware('role:especialista,cirugia');
    Route::get('/surgical-requisitions', [SurgicalRequisitionController::class, 'index'])->middleware('role:admin,almacen,especialista,cirugia');
    Route::post('/surgical-requisitions', [SurgicalRequisitionController::class, 'store'])->middleware('role:admin,especialista,cirugia');
    Route::patch('/surgical-requisitions/{id}', [SurgicalRequisitionController::class, 'update'])->middleware('role:admin,almacen');

    Route::get('/inventory', [HospitalController::class, 'inventory'])->middleware('role:admin,farmacia,compras,almacen');
    Route::post('/inventory', [HospitalController::class, 'storeInventoryItem'])->middleware('role:admin,farmacia,compras,almacen');
    Route::patch('/inventory/{id}/stock', [HospitalController::class, 'adjustInventory'])->middleware('role:admin,farmacia,compras,almacen');
    Route::get('/dispensations', [HospitalController::class, 'dispensations'])->middleware('role:admin,farmacia');
    Route::post('/dispensations', [HospitalController::class, 'storeDispensation'])->middleware('role:admin,farmacia');
    Route::patch('/dispensations/{id}', [HospitalController::class, 'updateDispensation'])->middleware('role:admin,farmacia');

    Route::get('/meal-orders', [HospitalController::class, 'mealOrders'])->middleware('role:admin,nutricion,medico_general,especialista');
    Route::post('/meal-orders', [HospitalController::class, 'storeMealOrder'])->middleware('role:admin,nutricion,medico_general,especialista');
    Route::patch('/meal-orders/{id}', [HospitalController::class, 'updateMealOrder'])->middleware('role:admin,nutricion');

    Route::get('/suppliers', [HospitalController::class, 'suppliers'])
        ->middleware('role:admin,compras,almacen,farmacia,nutricion,enfermeria');
    Route::get('/purchase-orders', [HospitalController::class, 'purchaseOrders'])->middleware('role:admin,compras,almacen');
    Route::post('/purchase-orders', [HospitalController::class, 'storePurchaseOrder'])
        ->middleware('role:admin,compras,almacen,farmacia,nutricion,enfermeria');
    Route::patch('/purchase-orders/{id}', [HospitalController::class, 'updatePurchaseOrder'])->middleware('role:admin,compras,almacen');

    Route::get('/invoices', [BillingController::class, 'index'])->middleware('role:admin,recepcion');
    Route::post('/invoices', [BillingController::class, 'store'])->middleware('role:admin,recepcion');
    Route::post('/invoices/{id}/payments', [BillingController::class, 'pay'])->middleware('role:admin,recepcion');
    Route::patch('/invoices/{id}/cancel', [BillingController::class, 'cancel'])->middleware('role:admin');

    Route::get('/defects', [DefectReportController::class, 'index'])->middleware('role:admin');
    Route::post('/defects', [DefectReportController::class, 'store'])
        ->middleware('role:admin,recepcion,medico_general,especialista,enfermeria,farmacia,nutricion,compras,almacen,cirugia');
    Route::patch('/defects/{id}', [DefectReportController::class, 'update'])->middleware('role:admin');

    Route::get('/notifications', [HospitalController::class, 'notifications']);
    Route::patch('/notifications/read-all', [HospitalController::class, 'markAllNotificationsRead']);
    Route::patch('/notifications/{id}/read', [HospitalController::class, 'markNotificationRead']);

    Route::get('/users', [HospitalController::class, 'users'])->middleware('role:admin');
    Route::post('/users', [HospitalController::class, 'storeUser'])->middleware('role:admin');
    Route::patch('/users/{id}', [HospitalController::class, 'updateUser'])->middleware('role:admin');
});
