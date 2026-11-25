<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StorePatientRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->activeRoles()->intersect(['admin', 'recepcion'])->isNotEmpty() ?? false;
    }

    public function rules(): array
    {
        return [
            'documentId' => ['required', 'string', 'max:64', 'regex:/^[A-Za-z0-9ÁÉÍÓÚáéíóúÑñ -]+$/u', 'unique:patients,document_id'],
            'firstName' => ['required', 'string', 'max:100', 'regex:/^[\pL\pM\s.\'-]+$/u'],
            'lastName' => ['required', 'string', 'max:120', 'regex:/^[\pL\pM\s.\'-]+$/u'],
            'birthDate' => ['required', 'date', 'after_or_equal:'.now()->subYears(150)->toDateString(), 'before:today'],
            'gender' => ['required', Rule::in(['Masculino', 'Femenino', 'Otro'])],
            'phone' => ['nullable', 'string', 'max:32', 'regex:/^[0-9+() .-]+$/'],
            'email' => ['nullable', 'email', 'max:160'],
            'bloodType' => ['nullable', Rule::in(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'])],
            'allergies' => ['nullable', 'string', 'max:2000'],
            'emergencyContact' => ['nullable', 'array'],
            'temperatureC' => ['required', 'numeric', 'gt:0', 'lte:42'],
            'heightCm' => ['required', 'numeric', 'gt:0', 'lte:300'],
            'insuranceProvider' => ['nullable', 'string', 'max:120'],
            'insurancePolicy' => ['nullable', 'string', 'max:80'],
            'insuranceCoveragePercent' => ['nullable', 'numeric', 'between:0,100'],
        ];
    }

    public function messages(): array
    {
        return [
            'birthDate.before' => 'La fecha de nacimiento debe ser anterior a hoy; la edad debe ser mayor que cero.',
            'birthDate.after_or_equal' => 'La edad no puede superar los 150 años.',
            'temperatureC.gt' => 'La temperatura debe ser mayor que 0 °C.',
            'temperatureC.lte' => 'La temperatura no puede superar 42 °C.',
            'heightCm.gt' => 'La estatura debe ser mayor que 0 cm.',
            'heightCm.lte' => 'La estatura no puede superar los 300 cm.',
            'insuranceCoveragePercent.between' => 'La cobertura del seguro debe estar entre 0 % y 100 %.',
        ];
    }
}
