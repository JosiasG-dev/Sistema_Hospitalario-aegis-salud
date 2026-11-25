<?php

namespace App\Http\Requests;

use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdatePatientRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->activeRoles()
            ->intersect(['admin', 'recepcion', 'medico_general', 'especialista', 'enfermeria'])
            ->isNotEmpty() ?? false;
    }

    protected function prepareForValidation(): void
    {
        if (array_diff(array_keys($this->all()), $this->allowedFields())) {
            throw new AuthorizationException('Su rol no puede modificar uno o más de los campos enviados.');
        }
    }

    public function allowedFields(): array
    {
        $roles = $this->user()->activeRoles();
        $demographic = [
            'documentId', 'firstName', 'lastName', 'birthDate', 'gender',
            'phone', 'email', 'emergencyContact',
        ];
        $financial = ['insuranceProvider', 'insurancePolicy', 'insuranceCoveragePercent'];
        $clinical = ['bloodType', 'allergies', 'temperatureC', 'heightCm'];

        if ($this->user()->role === 'admin') {
            return [...$demographic, ...$financial, 'confirmPassword'];
        }
        if ($roles->contains('recepcion')) {
            return [...$demographic, ...$financial, ...$clinical, 'confirmPassword'];
        }
        if ($roles->intersect(['medico_general', 'especialista'])->isNotEmpty()) {
            return [...$demographic, 'bloodType', 'allergies', 'confirmPassword'];
        }

        return ['phone', 'email', 'allergies', 'emergencyContact', 'confirmPassword'];
    }

    public function rules(): array
    {
        return [
            'documentId' => [
                'sometimes', 'required', 'string', 'max:64', 'regex:/^[A-Za-z0-9ÁÉÍÓÚáéíóúÑñ -]+$/u',
                Rule::unique('patients', 'document_id')->ignore($this->route('id'), 'id'),
            ],
            'firstName' => ['sometimes', 'required', 'string', 'max:100', 'regex:/^[\pL\pM\s.\'-]+$/u'],
            'lastName' => ['sometimes', 'required', 'string', 'max:120', 'regex:/^[\pL\pM\s.\'-]+$/u'],
            'birthDate' => ['sometimes', 'required', 'date', 'after_or_equal:'.now()->subYears(150)->toDateString(), 'before:today'],
            'gender' => ['sometimes', 'required', Rule::in(['Masculino', 'Femenino', 'Otro'])],
            'phone' => ['sometimes', 'nullable', 'string', 'max:32', 'regex:/^[0-9+() .-]+$/'],
            'email' => ['sometimes', 'nullable', 'email', 'max:160'],
            'bloodType' => ['sometimes', 'nullable', Rule::in(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'])],
            'allergies' => ['sometimes', 'nullable', 'string', 'max:2000'],
            'emergencyContact' => ['sometimes', 'nullable', 'array'],
            'emergencyContact.name' => ['sometimes', 'nullable', 'string', 'max:160'],
            'emergencyContact.phone' => ['sometimes', 'nullable', 'string', 'max:32', 'regex:/^[0-9+() .-]+$/'],
            'emergencyContact.relation' => ['sometimes', 'nullable', 'string', 'max:100'],
            'temperatureC' => ['sometimes', 'required', 'numeric', 'gt:0', 'lte:42'],
            'heightCm' => ['sometimes', 'required', 'numeric', 'gt:0', 'lte:300'],
            'insuranceProvider' => ['sometimes', 'nullable', 'string', 'max:120'],
            'insurancePolicy' => ['sometimes', 'nullable', 'string', 'max:80'],
            'insuranceCoveragePercent' => ['sometimes', 'nullable', 'numeric', 'between:0,100'],
            'confirmPassword' => ['required', 'string'],
        ];
    }
}
