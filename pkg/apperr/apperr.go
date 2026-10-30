// Package apperr carries an HTTP status with an error, so services can say what went wrong
// without knowing about HTTP, and handlers can answer with the right status.
package apperr

import (
	"errors"
	"net/http"
)

type Error struct {
	Status int
	Msg    string
	Err    error // cause, kept for errors.Is/As; not shown to clients when Msg is set
}

func (e *Error) Error() string {
	if e.Msg != "" {
		return e.Msg
	}
	return e.Err.Error()
}

func (e *Error) Unwrap() error { return e.Err }

func BadRequest(msg string) error  { return &Error{Status: http.StatusBadRequest, Msg: msg} }
func Forbidden(msg string) error   { return &Error{Status: http.StatusForbidden, Msg: msg} }
func NotFound(msg string) error    { return &Error{Status: http.StatusNotFound, Msg: msg} }
func Conflict(err error) error     { return &Error{Status: http.StatusConflict, Err: err} }
func TooLarge(msg string) error    { return &Error{Status: http.StatusRequestEntityTooLarge, Msg: msg} }
func Unsupported(msg string) error { return &Error{Status: http.StatusUnsupportedMediaType, Msg: msg} }

// Status is the HTTP status for err: its own if it is an *Error, otherwise 500.
func Status(err error) int {
	var e *Error
	if errors.As(err, &e) {
		return e.Status
	}
	return http.StatusInternalServerError
}
